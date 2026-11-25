import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";

let s3Instance: S3Client | null = null;
let sqsInstance: SQSClient | null = null;

function getAwsRegion(): string {
  return process.env.AWS_REGION || "eu-west-1";
}

function getAwsCredentials():
  | { accessKeyId: string; secretAccessKey: string }
  | undefined {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (accessKeyId && secretAccessKey) {
    return { accessKeyId, secretAccessKey };
  }
  return undefined;
}

export function getS3Client(): S3Client {
  if (!s3Instance) {
    s3Instance = new S3Client({
      region: getAwsRegion(),
      credentials: getAwsCredentials(),
    });
  }
  return s3Instance;
}

export function getSQSClient(): SQSClient {
  if (!sqsInstance) {
    sqsInstance = new SQSClient({
      region: getAwsRegion(),
      credentials: getAwsCredentials(),
    });
  }
  return sqsInstance;
}

export function getS3BucketName(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET no está configurado en las variables de entorno.");
  }
  return bucket;
}

export function getSQSQueueUrl(): string {
  const queueUrl = process.env.AWS_SQS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("AWS_SQS_QUEUE_URL no está configurado en las variables de entorno.");
  }
  return queueUrl;
}
