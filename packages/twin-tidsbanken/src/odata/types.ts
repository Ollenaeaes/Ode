/** Parsed OData query options */
export interface ODataQuery {
  $select?: string[];
  $filter?: FilterExpression;
  $orderby?: OrderByClause[];
  $expand?: string[];
  $skip?: number;
  $top?: number;
}

export type FilterExpression =
  | ComparisonFilter
  | LogicalFilter
  | NotFilter
  | FunctionFilter;

export interface ComparisonFilter {
  type: 'comparison';
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le';
  value: string | number | boolean | null;
}

export interface LogicalFilter {
  type: 'logical';
  operator: 'and' | 'or';
  left: FilterExpression;
  right: FilterExpression;
}

export interface NotFilter {
  type: 'not';
  expression: FilterExpression;
}

export interface FunctionFilter {
  type: 'function';
  name: 'startswith' | 'endswith' | 'substringof';
  field: string;
  value: string;
}

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SqlResult {
  where: string;
  params: unknown[];
  orderBy: string;
  select: string;
  limit: number;
  offset: number;
}

export interface ODataResponse<T = unknown> {
  value: T[];
  '@odata.nextLink'?: string;
}
