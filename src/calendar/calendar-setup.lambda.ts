import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types'; // eslint-disable-line import/no-unresolved
import { S3, SSM, STS } from 'aws-sdk';
import { CalendarSourceType } from './calendar';

export const handler = async (event: OnEventRequest): Promise<OnEventResponse> => {
  const bucketName = event.ResourceProperties.BucketName;
  const calendarName = event.ResourceProperties.CalendarName;
  const calendarBody = event.ResourceProperties.CalendarBody;
  const roleArn = event.ResourceProperties.RoleArn;

  let calendar: string;

  if (event.ResourceProperties.SourceType === CalendarSourceType.PATH) {
    calendar = calendarBody;
  } else {
    const s3 = roleArn ? await getSession(roleArn) : new S3();
    calendar = (await s3.getObject({
      Bucket: bucketName,
      Key: calendarName,
    }).promise()).Body!.toString();
  }

  const ssm = new SSM();

  if (event.RequestType === 'Create') {
    const createDocumentResponse = await ssm.createDocument({
      Name: calendarName,
      Content: calendar,
      DocumentType: 'ChangeCalendar',
      DocumentFormat: 'TEXT',
    }).promise();
    console.log('Create document: %j', createDocumentResponse);
  }

  if (event.RequestType === 'Update') {
    const updateDocumentResponse = await ssm.updateDocument({
      Name: calendarName,
      Content: calendar,
      DocumentVersion: '$',
    }).promise();
    console.log('Update document: %j', updateDocumentResponse);
  }

  if (event.RequestType === 'Delete') {
    const deleteDocumentResponse = await ssm.deleteDocument({
      Name: calendarName,
    }).promise();
    console.log('Delete document: %j', deleteDocumentResponse);
  }

  return {};
};

const getSession = async (roleArn: string) => {
  const sts = new STS();
  const credentials = await sts
    .assumeRole({
      RoleArn: roleArn,
      RoleSessionName: 'Calendar-Setup-Role',
    })
    .promise();
  return new S3({
    credentials: {
      accessKeyId: credentials.Credentials!.AccessKeyId,
      secretAccessKey: credentials.Credentials!.SecretAccessKey,
      sessionToken: credentials.Credentials?.SessionToken,
    },
  });
};