import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket =
      this.configService.get<string>('STORAGE_BUCKET') || 'adsoleo-bucket';
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION') || 'eu-central-1',
      credentials: {
        accessKeyId: this.configService.get<string>('STORAGE_ACCESS_KEY') || '',
        secretAccessKey:
          this.configService.get<string>('STORAGE_SECRET_KEY') || '',
      },
    });
  }

  async generatePresignedUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    const key = `uploads/${Date.now()}-${filename}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return { url, key };
  }
}
