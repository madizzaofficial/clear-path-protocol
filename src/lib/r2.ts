import { S3Client } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

// R2 rejects presigned PUT URLs that contain CRC32 checksum query params (x-amz-checksum-crc32).
// Remove the flexible checksums middlewares so they are never added to the signed URL.
client.middlewareStack.remove("flexibleChecksumsInputMiddleware");
client.middlewareStack.remove("flexibleChecksumsMiddleware");

export const r2 = client;
