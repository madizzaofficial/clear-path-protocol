import { createServerFn } from "@tanstack/react-start";

async function uploadToR2(prefix: string, fileName: string, contentType: string, base64: string) {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!;
  const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

  if (!bucket || !publicUrlBase) throw new Error("R2 env vars missing");

  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { r2 } = await import("@/lib/r2");

  const key = `${prefix}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const presignedUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: 60 }
  );

  const body = Buffer.from(base64, "base64");
  const response = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!response.ok) throw new Error(`Upload échoué (${response.status})`);

  return { publicUrl: `${publicUrlBase}/${key}` };
}

// Restrict uploads to a safe content-type allowlist to avoid hosting HTML/scripts
// on the public R2 domain (stored-XSS / arbitrary file hosting).
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const ALLOWED_RESOURCE_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "video/mp4",
  "video/webm",
]);

export const uploadProductImageFn = createServerFn({ method: "POST" })
  .inputValidator((d: { fileName: string; contentType: string; base64: string; callerToken: string }) => d)
  .handler(async (ctx) => {
    const { fileName, contentType, base64, callerToken } = ctx.data;
    const { requireAdmin } = await import("@/lib/server-auth");
    await requireAdmin(callerToken);
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw new Error("Type de fichier non autorisé.");
    return uploadToR2("product-images", fileName, contentType, base64);
  });

export const uploadLessonResourceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { fileName: string; contentType: string; base64: string; callerToken: string }) => d)
  .handler(async (ctx) => {
    const { fileName, contentType, base64, callerToken } = ctx.data;
    const { requireAdmin } = await import("@/lib/server-auth");
    await requireAdmin(callerToken);
    if (!ALLOWED_RESOURCE_TYPES.has(contentType)) throw new Error("Type de fichier non autorisé.");
    return uploadToR2("lesson-resources", fileName, contentType, base64);
  });
