// import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as iam from "aws-cdk-lib/aws-iam";

export interface EventBridgeConstructProps {
  envName: string;
  projectName: string;
  stateMachineArn: string;
  dataInputBucketName: string;
}

export class EventBridgeConstruct extends Construct {
  constructor(scope: Construct, id: string, props: EventBridgeConstructProps) {
    super(scope, id);

    // EventBridgeのルールを定義（ここでは、S3 Put イベント）
    const s3PutRule = new events.Rule(
      this,
      `${props.projectName}-${props.envName}-s3-put-rule`,
      {
        eventPattern: {
          source: ["aws.s3"],
          detailType: ["Object Created"],
          detail: {
            bucket: {
              name: [props.dataInputBucketName],
            },
            object: {
              key: [{ prefix: "input/" }],
            },
          },
        },
      }
    );
    // EventBridge が Step Functions を起動するための IAM ロールを作成
    const eventBridgeExecutionRole = new iam.Role(
      this,
      `EventBridgeExecutionRole`,
      {
        assumedBy: new iam.ServicePrincipal("events.amazonaws.com"), // 信頼ポリシー設定
        description:
          "An IAM role for EventBridge to Start Step Functions Execution",
        roleName: `EventBridgeExecutionRoleForStepFunctions-${props.envName}`,
      }
    );

    eventBridgeExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["states:StartExecution"], // 許可するアクション
        resources: [props.stateMachineArn], // ステートマシンのARN
      })
    );
    // ステップ関数をS3 Put Eventのターゲットとして設定
    const stateMachine = sfn.StateMachine.fromStateMachineArn(
      this,
      "ImportedStateMachine",
      props.stateMachineArn
    );
    s3PutRule.addTarget(
      new eventsTargets.SfnStateMachine(stateMachine, {
        role: eventBridgeExecutionRole,
      })
    );
  }
}
