import boto3
import os

def lambda_handler(event, context):
    # 環境変数からインスタンスIDを取得
    instance_id = os.environ['INSTANCE_ID']
    # EC2クライアントの初期化
    ec2 = boto3.client('ec2')
    # EC2インスタンスの停止
    response = ec2.stop_instances(InstanceIds=[instance_id])
    return response
