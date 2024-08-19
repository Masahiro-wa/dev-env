import boto3
from common.log import log
import os, json

def lambda_handler(event, context):
    log.info(f'lambda started: {json.dumps(event)}')
    instance_id = os.environ['INSTANCE_ID']
    ec2 = boto3.client('ec2')

    action = event.get('action')
    response = {}
    
    if action == 'stop':
        response = ec2.stop_instances(InstanceIds=[instance_id])
        log.info(f'EC2 instance stopped: {response}')
    elif action == 'start':
        response = ec2.start_instances(InstanceIds=[instance_id])
        log.info(f'EC2 instance started: {response}')
    else:    
        response = {'message':'Invalid action'}
        log.error(f'invalid action: {response}')
    
    return response
