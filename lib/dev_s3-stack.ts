import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as fs from 'fs-extra';
import * as archiver from 'archiver';
import * as path from 'path';
import { envs } from '../utils/envs';

export class S3Stack extends cdk.Stack {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const env_name = envs.get('ENV_NAME');
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}` +
                      `${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}` +
                      `${String(now.getMinutes()).padStart(2, '0')}`;

    // S3バケットの作成
    const bucket = new s3.Bucket(this, `${env_name}.config.${timestamp}`, {
      versioned: true,
    });

    // 一時的な/tmpディレクトリを作成
    const tmpDir = path.join(__dirname, '../src/tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { mode: 0o777 }); // 0o777は完全な読み書き実行権限
        console.log(`ディレクトリが作成されました: ${tmpDir}`);
    };

    // /src/配下の各ディレクトリを検出
    const lambdaRootDir = path.join(__dirname, '../src/lambda');
    const ec2RootDir = path.join(__dirname, '../src/ec2/dev');

    const directories = fs.readdirSync(lambdaRootDir).filter(file => {
      return fs.statSync(path.join(lambdaRootDir, file)).isDirectory();
    });

    // 各ディレクトリに対してZIPを作成し、S3にアップロード
    directories.forEach(async (dir) => {
      const sourceDir = path.join(lambdaRootDir, dir);
      const zipFilePath = path.join(tmpDir, `${dir}.zip`);

      // ZIPファイルの作成が完了するまで待機
      await this.createZipFile(sourceDir, zipFilePath);

      if (!fs.existsSync(zipFilePath)) {
        throw new Error(`ZIPファイルが見つかりません: ${zipFilePath}`);
      }

      new s3deploy.BucketDeployment(this, `DeployLambdaZip-${dir}`, {
        sources: [s3deploy.Source.asset(zipFilePath)],
        destinationBucket: bucket,
        destinationKeyPrefix: `lambda/${dir}/`, // 各関数ごとに異なるS3パス
      });

      // ZIPファイルを削除
      fs.removeSync(zipFilePath);
    });

    // 処理終了後に/tmpディレクトリを削除
    fs.removeSync(tmpDir);

    new s3deploy.BucketDeployment(this, `DeployEc2Configs`, {
        sources: [s3deploy.Source.asset(ec2RootDir)],
        destinationBucket: bucket,
        destinationKeyPrefix: `ec2/dev/`, // 各関数ごとに異なるS3パス
      });

    this.bucket = bucket;
  }

  // ZIPファイルを作成するメソッド
  private createZipFile(sourceDir: string, outputFilePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputFilePath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 圧縮レベルを設定
      });

      output.on('close', () => {
        console.log(`ZIPファイルが作成されました: ${archive.pointer()} total bytes`);
        resolve();
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('Warning:', err.message);
          resolve(); // 警告であれば処理を続行
        } else {
          reject(err); // エラーが発生した場合はreject
        }
      });

      archive.on('error', (err) => {
        console.error('Error:', err.message);
        reject(err);
      });

      archive.pipe(output);

      // ディレクトリ全体をZIPに追加
      archive.directory(sourceDir, false);

      // ZIPファイルの最終化
      archive.finalize().then(() => {
        console.log('ZIPファイルの作成が完了しました。');
      }).catch(err => {
        console.error('ZIPファイルの作成中にエラーが発生しました:', err.message);
        reject(err);
      });
    });
  }
}
