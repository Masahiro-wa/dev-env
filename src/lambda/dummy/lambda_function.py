import boto3
from common.log import log
import os, json

def lambda_handler(event, context):
    log.info(f'lambda started: {json.dumps(event)}')
    log.info(f'this is a dummy function')

