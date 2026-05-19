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

export const uploadProductImageFn = createServerFn({ method: "POST" })
  .inputValidator((d: { fileName: string; contentType: string; base64: string }) => d)
  .handler(async (ctx) => {
    const { fileName, contentType, base64 } = ctx.data;
    return uploadToR2("product-images", fileName, contentType, base64);
  });

export const uploadLessonResourceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { fileName: string; contentType: string; base64: string }) => d)
  .handler(async (ctx) => {
    const { fileName, contentType, base64 } = ctx.data;
    return uploadToR2("lesson-resources", fileName, contentType, base64);
  });
