import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  endpoint: `https://s3.${process.env.AWS_REGION || "eu-north-1"}.amazonaws.com`,
  forcePathStyle: false,
});

const BUCKET = process.env.AWS_S3_BUCKET!;

export const uploadToS3 = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string = "documents"
): Promise<string> => {
  const key = `${folder}/${crypto.randomUUID()}-${originalName}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  return key;
};

export const getPresignedUrl = async (key: string, expiresIn: number = 900): Promise<string> => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};
