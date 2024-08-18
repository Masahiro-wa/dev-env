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

    // S3バケットの作成
    const bucket = new s3.Bucket(this, `${env_name}.config`, {
      versioned: true,
    });    
    /* 都度ディレクトリーごと作成したかったが、cdk ls でエラーが出るため、一旦コメントアウト
    if (!fs.existsSync(zipDir)) {
        try {
            fs.mkdirSync(zipDir, { mode: 0o777 });
            console.log(`ディレクトリが作成されました: ${zipDir}`);
        } catch (error) {
            console.error(`ディレクトリの作成に失敗しました: ${zipDir}`, error);
            throw error;
        }
    } else {
        console.log(`ディレクトリは既に存在します: ${zipDir}`);
    }
    */

    // lambda 関数をzip化してS3にアップロード処理
    const zipDir = path.join(__dirname, '../src/tmp');
    const lambdaRootDir = path.join(__dirname, '../src/lambda');
    const directories = fs.readdirSync(lambdaRootDir).filter(file => {
      return fs.statSync(path.join(lambdaRootDir, file)).isDirectory();
    });
    // 各ディレクトリに対してZIPを作成し、S3にアップロード
    directories.forEach(async (dir) => {
      const sourceDir = path.join(lambdaRootDir, dir);
      const zipFilePath = path.join(zipDir, `${dir}.zip`);
      // ZIPファイルの作成が完了するまで待機
      await this.createZipFile(sourceDir, zipFilePath);

      if (!fs.existsSync(zipFilePath)) {
        throw new Error(`ZIPファイルが見つかりません: ${zipFilePath}`);
      }
    });

    new s3deploy.BucketDeployment(this, `DeployLambdaZip`, {
      sources: [s3deploy.Source.asset(zipDir)],
      destinationBucket: bucket,
      destinationKeyPrefix: `lambda/`
    });


    // ec2関連のディレクトリをそのままS3にアップロード
    const ec2RootDir = path.join(__dirname, '../src/ec2');
    new s3deploy.BucketDeployment(this, 'DeployEc2Files', {
        sources: [s3deploy.Source.asset(ec2RootDir)],
        destinationBucket: bucket,
        destinationKeyPrefix: 'ec2/', // S3でのディレクトリパスを指定
      });

    this.bucket = bucket;
    // ZIPファイルを削除. 
    // この処理は必須ではないが、ディスクスペースを節約するために削除する.
    // なんか消えなくなったのでコメントアウトする.
    //directories.forEach( (dir) => {
    //  const zipFilePath = path.join(zipDir, `${dir}.zip`);
    //  fs.removeSync(zipFilePath);
    //});
  }

  

  // ZIPファイルを作成するメソッド
  private createZipFile(sourceDir: string, outputFilePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        console.log(`Creating ZIP file: ${outputFilePath} from source: ${sourceDir}`);

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

        if (fs.existsSync(sourceDir)) {
            console.log(`Source directory exists: ${sourceDir}`);
            archive.directory(sourceDir, false);
        } else {
            console.error(`Source directory does not exist: ${sourceDir}`);
            reject(new Error(`Source directory does not exist: ${sourceDir}`));
        }

        archive.finalize().then(() => {
            console.log('ZIPファイルの作成が完了しました。');
        }).catch(err => {
            console.error('ZIPファイルの作成中にエラーが発生しました:', err.message);
            reject(err);
        });
    });
  };
}
