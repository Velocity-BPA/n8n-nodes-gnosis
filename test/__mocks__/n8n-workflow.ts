// Mock n8n-workflow types and classes for testing

export interface INodeExecutionData {
  json: Record<string, unknown>;
  pairedItem?: { item: number };
}

export interface INodeProperties {
  displayName: string;
  name: string;
  type: string;
  default?: unknown;
  description?: string;
  required?: boolean;
  options?: Array<{ name: string; value: string; description?: string; action?: string }>;
  displayOptions?: {
    show?: Record<string, string[]>;
    hide?: Record<string, string[]>;
  };
  noDataExpression?: boolean;
  placeholder?: string;
  typeOptions?: Record<string, unknown>;
}

export interface INodeTypeDescription {
  displayName: string;
  name: string;
  icon?: string;
  group: string[];
  version: number;
  subtitle?: string;
  description: string;
  defaults: { name: string };
  inputs: string[];
  outputs: string[];
  credentials?: Array<{ name: string; required?: boolean }>;
  properties: INodeProperties[];
  polling?: boolean;
}

export interface IExecuteFunctions {
  getInputData(): INodeExecutionData[];
  getNodeParameter(name: string, index: number, defaultValue?: unknown): unknown;
  getCredentials(name: string): Promise<Record<string, unknown>>;
  getNode(): { name: string };
  continueOnFail(): boolean;
}

export interface IPollFunctions {
  getNodeParameter(name: string, defaultValue?: unknown): unknown;
  getCredentials(name: string): Promise<Record<string, unknown>>;
  getWorkflowStaticData(type: string): Record<string, unknown>;
}

export interface INodeType {
  description: INodeTypeDescription;
  execute?(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
  poll?(this: IPollFunctions): Promise<INodeExecutionData[][] | null>;
}

export interface ICredentialType {
  name: string;
  displayName: string;
  properties: INodeProperties[];
  authenticate?: unknown;
  test?: unknown;
}

export class NodeOperationError extends Error {
  constructor(
    node: { name: string },
    message: string,
    options?: { itemIndex?: number; description?: string },
  ) {
    super(message);
    this.name = 'NodeOperationError';
  }
}

export class NodeApiError extends Error {
  constructor(
    node: { name: string },
    error: Error | { message: string },
    options?: Record<string, unknown>,
  ) {
    super(error instanceof Error ? error.message : error.message);
    this.name = 'NodeApiError';
  }
}
