import * as Minio from "minio";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

const BUCKET = process.env.MINIO_BUCKET || "sahidfreightdocuments";

export const ensureBucket = async () => {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`✅ MinIO bucket "${BUCKET}" created`);
  }
};

export const uploadFile = async (
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> => {
  await ensureBucket();
  await minioClient.putObject(BUCKET, fileName, buffer, buffer.length, {
    "Content-Type": mimeType,
  });
  return `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${BUCKET}/${fileName}`;
};

export const deleteFile = async (fileName: string): Promise<void> => {
  await minioClient.removeObject(BUCKET, fileName);
};

// Generate presigned URL valid for 5 minutes (admin document viewing)
export const getPresignedUrl = async (fileUrl: string): Promise<string> => {
  const bucket = process.env.MINIO_BUCKET || "sahidfreightdocuments";
  const urlObj = new URL(fileUrl);
  const objectName = urlObj.pathname.replace("/" + bucket + "/", "");
  return await minioClient.presignedGetObject(bucket, objectName, 5 * 60);
};
