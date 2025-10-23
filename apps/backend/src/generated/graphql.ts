export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  bigint: { input: any; output: any; }
  bpchar: { input: any; output: any; }
  currency_enum: { input: any; output: any; }
  date: { input: any; output: any; }
  image_type_enum: { input: any; output: any; }
  jsonb: { input: Record<string, any>; output: Record<string, any>; }
  location_type_enum: { input: any; output: any; }
  mobile_payment_transaction_type_enum: { input: any; output: any; }
  numeric: { input: number; output: number; }
  order_hold_status_enum: { input: any; output: any; }
  order_status: { input: any; output: any; }
  payment_entity_type: { input: any; output: any; }
  rating_type_enum: { input: any; output: any; }
  time: { input: any; output: any; }
  timestamptz: { input: string; output: string; }
  transaction_type_enum: { input: any; output: any; }
  uuid: { input: string; output: string; }
  weight_units_enum: { input: any; output: any; }
};

/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type Boolean_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Boolean']['input']>;
  _gt?: InputMaybe<Scalars['Boolean']['input']>;
  _gte?: InputMaybe<Scalars['Boolean']['input']>;
  _in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Boolean']['input']>;
  _lte?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<Scalars['Boolean']['input']>;
  _nin?: InputMaybe<Array<Scalars['Boolean']['input']>>;
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type Int_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Int']['input']>;
  _gt?: InputMaybe<Scalars['Int']['input']>;
  _gte?: InputMaybe<Scalars['Int']['input']>;
  _in?: InputMaybe<Array<Scalars['Int']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Int']['input']>;
  _lte?: InputMaybe<Scalars['Int']['input']>;
  _neq?: InputMaybe<Scalars['Int']['input']>;
  _nin?: InputMaybe<Array<Scalars['Int']['input']>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Array_Comparison_Exp = {
  /** is the array contained in the given array value */
  _contained_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the array contain the given value */
  _contains?: InputMaybe<Array<Scalars['String']['input']>>;
  _eq?: InputMaybe<Array<Scalars['String']['input']>>;
  _gt?: InputMaybe<Array<Scalars['String']['input']>>;
  _gte?: InputMaybe<Array<Scalars['String']['input']>>;
  _in?: InputMaybe<Array<Array<Scalars['String']['input']>>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Array<Scalars['String']['input']>>;
  _lte?: InputMaybe<Array<Scalars['String']['input']>>;
  _neq?: InputMaybe<Array<Scalars['String']['input']>>;
  _nin?: InputMaybe<Array<Array<Scalars['String']['input']>>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['String']['input']>;
  _gt?: InputMaybe<Scalars['String']['input']>;
  _gte?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['String']['input']>;
  _in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['String']['input']>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['String']['input']>;
  _lt?: InputMaybe<Scalars['String']['input']>;
  _lte?: InputMaybe<Scalars['String']['input']>;
  _neq?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['String']['input']>;
  _nin?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['String']['input']>;
};

/** Tracks all account transactions with memo and reference linking */
export type Account_Transactions = {
  __typename?: 'account_transactions';
  /** An object relationship */
  account: Accounts;
  account_id: Scalars['uuid']['output'];
  /** Transaction amount (positive for credits, negative for debits) */
  amount: Scalars['numeric']['output'];
  created_at: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  /** Optional memo/notes for the transaction */
  memo?: Maybe<Scalars['String']['output']>;
  /** Optional reference to other business objects (orders, payments, etc.) */
  reference_id?: Maybe<Scalars['uuid']['output']>;
  /** Type of transaction (deposit, withdrawal, hold, release, transfer, payment, refund) */
  transaction_type: Scalars['transaction_type_enum']['output'];
};

/** aggregated selection of "account_transactions" */
export type Account_Transactions_Aggregate = {
  __typename?: 'account_transactions_aggregate';
  aggregate?: Maybe<Account_Transactions_Aggregate_Fields>;
  nodes: Array<Account_Transactions>;
};

export type Account_Transactions_Aggregate_Bool_Exp = {
  count?: InputMaybe<Account_Transactions_Aggregate_Bool_Exp_Count>;
};

export type Account_Transactions_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Account_Transactions_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Account_Transactions_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "account_transactions" */
export type Account_Transactions_Aggregate_Fields = {
  __typename?: 'account_transactions_aggregate_fields';
  avg?: Maybe<Account_Transactions_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Account_Transactions_Max_Fields>;
  min?: Maybe<Account_Transactions_Min_Fields>;
  stddev?: Maybe<Account_Transactions_Stddev_Fields>;
  stddev_pop?: Maybe<Account_Transactions_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Account_Transactions_Stddev_Samp_Fields>;
  sum?: Maybe<Account_Transactions_Sum_Fields>;
  var_pop?: Maybe<Account_Transactions_Var_Pop_Fields>;
  var_samp?: Maybe<Account_Transactions_Var_Samp_Fields>;
  variance?: Maybe<Account_Transactions_Variance_Fields>;
};


/** aggregate fields of "account_transactions" */
export type Account_Transactions_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Account_Transactions_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "account_transactions" */
export type Account_Transactions_Aggregate_Order_By = {
  avg?: InputMaybe<Account_Transactions_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Account_Transactions_Max_Order_By>;
  min?: InputMaybe<Account_Transactions_Min_Order_By>;
  stddev?: InputMaybe<Account_Transactions_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Account_Transactions_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Account_Transactions_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Account_Transactions_Sum_Order_By>;
  var_pop?: InputMaybe<Account_Transactions_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Account_Transactions_Var_Samp_Order_By>;
  variance?: InputMaybe<Account_Transactions_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "account_transactions" */
export type Account_Transactions_Arr_Rel_Insert_Input = {
  data: Array<Account_Transactions_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Account_Transactions_On_Conflict>;
};

/** aggregate avg on columns */
export type Account_Transactions_Avg_Fields = {
  __typename?: 'account_transactions_avg_fields';
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "account_transactions" */
export type Account_Transactions_Avg_Order_By = {
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "account_transactions". All fields are combined with a logical 'AND'. */
export type Account_Transactions_Bool_Exp = {
  _and?: InputMaybe<Array<Account_Transactions_Bool_Exp>>;
  _not?: InputMaybe<Account_Transactions_Bool_Exp>;
  _or?: InputMaybe<Array<Account_Transactions_Bool_Exp>>;
  account?: InputMaybe<Accounts_Bool_Exp>;
  account_id?: InputMaybe<Uuid_Comparison_Exp>;
  amount?: InputMaybe<Numeric_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  memo?: InputMaybe<String_Comparison_Exp>;
  reference_id?: InputMaybe<Uuid_Comparison_Exp>;
  transaction_type?: InputMaybe<Transaction_Type_Enum_Comparison_Exp>;
};

/** unique or primary key constraints on table "account_transactions" */
export enum Account_Transactions_Constraint {
  /** unique or primary key constraint on columns "id" */
  AccountTransactionsPkey = 'account_transactions_pkey'
}

/** input type for incrementing numeric columns in table "account_transactions" */
export type Account_Transactions_Inc_Input = {
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "account_transactions" */
export type Account_Transactions_Insert_Input = {
  account?: InputMaybe<Accounts_Obj_Rel_Insert_Input>;
  account_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Optional memo/notes for the transaction */
  memo?: InputMaybe<Scalars['String']['input']>;
  /** Optional reference to other business objects (orders, payments, etc.) */
  reference_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Type of transaction (deposit, withdrawal, hold, release, transfer, payment, refund) */
  transaction_type?: InputMaybe<Scalars['transaction_type_enum']['input']>;
};

/** aggregate max on columns */
export type Account_Transactions_Max_Fields = {
  __typename?: 'account_transactions_max_fields';
  account_id?: Maybe<Scalars['uuid']['output']>;
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['numeric']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Optional memo/notes for the transaction */
  memo?: Maybe<Scalars['String']['output']>;
  /** Optional reference to other business objects (orders, payments, etc.) */
  reference_id?: Maybe<Scalars['uuid']['output']>;
  /** Type of transaction (deposit, withdrawal, hold, release, transfer, payment, refund) */
  transaction_type?: Maybe<Scalars['transaction_type_enum']['output']>;
};

/** order by max() on columns of table "account_transactions" */
export type Account_Transactions_Max_Order_By = {
  account_id?: InputMaybe<Order_By>;
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Optional memo/notes for the transaction */
  memo?: InputMaybe<Order_By>;
  /** Optional reference to other business objects (orders, payments, etc.) */
  reference_id?: InputMaybe<Order_By>;
  /** Type of transaction (deposit, withdrawal, hold, release, transfer, payment, refund) */
  transaction_type?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Account_Transactions_Min_Fields = {
  __typename?: 'account_transactions_min_fields';
  account_id?: Maybe<Scalars['uuid']['output']>;
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['numeric']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Optional memo/notes for the transaction */
  memo?: Maybe<Scalars['String']['output']>;
  /** Optional reference to other business objects (orders, payments, etc.) */
  reference_id?: Maybe<Scalars['uuid']['output']>;
  /** Type of transaction (deposit, withdrawal, hold, release, transfer, payment, refund) */
  transaction_type?: Maybe<Scalars['transaction_type_enum']['output']>;
};

/** order by min() on columns of table "account_transactions" */
export type Account_Transactions_Min_Order_By = {
  account_id?: InputMaybe<Order_By>;
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Optional memo/notes for the transaction */
  memo?: InputMaybe<Order_By>;
  /** Optional reference to other business objects (orders, payments, etc.) */
  reference_id?: InputMaybe<Order_By>;
  /** Type of transaction (deposit, withdrawal, hold, release, transfer, payment, refund) */
  transaction_type?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "account_transactions" */
export type Account_Transactions_Mutation_Response = {
  __typename?: 'account_transactions_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Account_Transactions>;
};

/** on_conflict condition type for table "account_transactions" */
export type Account_Transactions_On_Conflict = {
  constraint: Account_Transactions_Constraint;
  update_columns?: Array<Account_Transactions_Update_Column>;
  where?: InputMaybe<Account_Transactions_Bool_Exp>;
};

/** Ordering options when selecting data from "account_transactions". */
export type Account_Transactions_Order_By = {
  account?: InputMaybe<Accounts_Order_By>;
  account_id?: InputMaybe<Order_By>;
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  memo?: InputMaybe<Order_By>;
  reference_id?: InputMaybe<Order_By>;
  transaction_type?: InputMaybe<Order_By>;
};

/** primary key columns input for table: account_transactions */
export type Account_Transactions_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "account_transactions" */
export enum Account_Transactions_Select_Column {
  /** column name */
  AccountId = 'account_id',
  /** column name */
  Amount = 'amount',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  Memo = 'memo',
  /** column name */
  ReferenceId = 'reference_id',
  /** column name */
  TransactionType = 'transaction_type'
}

/** input type for updating data in table "account_transactions" */
export type Account_Transactions_Set_Input = {
  account_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Optional memo/notes for the transaction */
  memo?: InputMaybe<Scalars['String']['input']>;
  /** Optional reference to other business objects (orders, payments, etc.) */
  reference_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Type of transaction (deposit, withdrawal, hold, release, transfer, payment, refund) */
  transaction_type?: InputMaybe<Scalars['transaction_type_enum']['input']>;
};

/** aggregate stddev on columns */
export type Account_Transactions_Stddev_Fields = {
  __typename?: 'account_transactions_stddev_fields';
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "account_transactions" */
export type Account_Transactions_Stddev_Order_By = {
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Account_Transactions_Stddev_Pop_Fields = {
  __typename?: 'account_transactions_stddev_pop_fields';
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "account_transactions" */
export type Account_Transactions_Stddev_Pop_Order_By = {
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Account_Transactions_Stddev_Samp_Fields = {
  __typename?: 'account_transactions_stddev_samp_fields';
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "account_transactions" */
export type Account_Transactions_Stddev_Samp_Order_By = {
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "account_transactions" */
export type Account_Transactions_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Account_Transactions_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Account_Transactions_Stream_Cursor_Value_Input = {
  account_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Optional memo/notes for the transaction */
  memo?: InputMaybe<Scalars['String']['input']>;
  /** Optional reference to other business objects (orders, payments, etc.) */
  reference_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Type of transaction (deposit, withdrawal, hold, release, transfer, payment, refund) */
  transaction_type?: InputMaybe<Scalars['transaction_type_enum']['input']>;
};

/** aggregate sum on columns */
export type Account_Transactions_Sum_Fields = {
  __typename?: 'account_transactions_sum_fields';
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "account_transactions" */
export type Account_Transactions_Sum_Order_By = {
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
};

/** update columns of table "account_transactions" */
export enum Account_Transactions_Update_Column {
  /** column name */
  AccountId = 'account_id',
  /** column name */
  Amount = 'amount',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  Memo = 'memo',
  /** column name */
  ReferenceId = 'reference_id',
  /** column name */
  TransactionType = 'transaction_type'
}

export type Account_Transactions_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Account_Transactions_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Account_Transactions_Set_Input>;
  /** filter the rows which have to be updated */
  where: Account_Transactions_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Account_Transactions_Var_Pop_Fields = {
  __typename?: 'account_transactions_var_pop_fields';
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "account_transactions" */
export type Account_Transactions_Var_Pop_Order_By = {
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Account_Transactions_Var_Samp_Fields = {
  __typename?: 'account_transactions_var_samp_fields';
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "account_transactions" */
export type Account_Transactions_Var_Samp_Order_By = {
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Account_Transactions_Variance_Fields = {
  __typename?: 'account_transactions_variance_fields';
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "account_transactions" */
export type Account_Transactions_Variance_Order_By = {
  /** Transaction amount (positive for credits, negative for debits) */
  amount?: InputMaybe<Order_By>;
};

/** User accounts with multiple currencies and balance tracking */
export type Accounts = {
  __typename?: 'accounts';
  /** An array relationship */
  account_transactions: Array<Account_Transactions>;
  /** An aggregate relationship */
  account_transactions_aggregate: Account_Transactions_Aggregate;
  /** Balance available for new orders */
  available_balance: Scalars['numeric']['output'];
  created_at: Scalars['timestamptz']['output'];
  currency: Scalars['currency_enum']['output'];
  id: Scalars['uuid']['output'];
  is_active?: Maybe<Scalars['Boolean']['output']>;
  /** An array relationship */
  mobile_payment_transactions: Array<Mobile_Payment_Transactions>;
  /** An aggregate relationship */
  mobile_payment_transactions_aggregate: Mobile_Payment_Transactions_Aggregate;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['numeric']['output']>;
  updated_at: Scalars['timestamptz']['output'];
  /** An object relationship */
  user: Users;
  user_id: Scalars['uuid']['output'];
  /** Balance held for pending orders */
  withheld_balance: Scalars['numeric']['output'];
};


/** User accounts with multiple currencies and balance tracking */
export type AccountsAccount_TransactionsArgs = {
  distinct_on?: InputMaybe<Array<Account_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Account_Transactions_Order_By>>;
  where?: InputMaybe<Account_Transactions_Bool_Exp>;
};


/** User accounts with multiple currencies and balance tracking */
export type AccountsAccount_Transactions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Account_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Account_Transactions_Order_By>>;
  where?: InputMaybe<Account_Transactions_Bool_Exp>;
};


/** User accounts with multiple currencies and balance tracking */
export type AccountsMobile_Payment_TransactionsArgs = {
  distinct_on?: InputMaybe<Array<Mobile_Payment_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mobile_Payment_Transactions_Order_By>>;
  where?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
};


/** User accounts with multiple currencies and balance tracking */
export type AccountsMobile_Payment_Transactions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mobile_Payment_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mobile_Payment_Transactions_Order_By>>;
  where?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
};

/** aggregated selection of "accounts" */
export type Accounts_Aggregate = {
  __typename?: 'accounts_aggregate';
  aggregate?: Maybe<Accounts_Aggregate_Fields>;
  nodes: Array<Accounts>;
};

export type Accounts_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Accounts_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Accounts_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Accounts_Aggregate_Bool_Exp_Count>;
};

export type Accounts_Aggregate_Bool_Exp_Bool_And = {
  arguments: Accounts_Select_Column_Accounts_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Accounts_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Accounts_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Accounts_Select_Column_Accounts_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Accounts_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Accounts_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Accounts_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Accounts_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "accounts" */
export type Accounts_Aggregate_Fields = {
  __typename?: 'accounts_aggregate_fields';
  avg?: Maybe<Accounts_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Accounts_Max_Fields>;
  min?: Maybe<Accounts_Min_Fields>;
  stddev?: Maybe<Accounts_Stddev_Fields>;
  stddev_pop?: Maybe<Accounts_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Accounts_Stddev_Samp_Fields>;
  sum?: Maybe<Accounts_Sum_Fields>;
  var_pop?: Maybe<Accounts_Var_Pop_Fields>;
  var_samp?: Maybe<Accounts_Var_Samp_Fields>;
  variance?: Maybe<Accounts_Variance_Fields>;
};


/** aggregate fields of "accounts" */
export type Accounts_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Accounts_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "accounts" */
export type Accounts_Aggregate_Order_By = {
  avg?: InputMaybe<Accounts_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Accounts_Max_Order_By>;
  min?: InputMaybe<Accounts_Min_Order_By>;
  stddev?: InputMaybe<Accounts_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Accounts_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Accounts_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Accounts_Sum_Order_By>;
  var_pop?: InputMaybe<Accounts_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Accounts_Var_Samp_Order_By>;
  variance?: InputMaybe<Accounts_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "accounts" */
export type Accounts_Arr_Rel_Insert_Input = {
  data: Array<Accounts_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Accounts_On_Conflict>;
};

/** aggregate avg on columns */
export type Accounts_Avg_Fields = {
  __typename?: 'accounts_avg_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['Float']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['Float']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "accounts" */
export type Accounts_Avg_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "accounts". All fields are combined with a logical 'AND'. */
export type Accounts_Bool_Exp = {
  _and?: InputMaybe<Array<Accounts_Bool_Exp>>;
  _not?: InputMaybe<Accounts_Bool_Exp>;
  _or?: InputMaybe<Array<Accounts_Bool_Exp>>;
  account_transactions?: InputMaybe<Account_Transactions_Bool_Exp>;
  account_transactions_aggregate?: InputMaybe<Account_Transactions_Aggregate_Bool_Exp>;
  available_balance?: InputMaybe<Numeric_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<Currency_Enum_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_active?: InputMaybe<Boolean_Comparison_Exp>;
  mobile_payment_transactions?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
  mobile_payment_transactions_aggregate?: InputMaybe<Mobile_Payment_Transactions_Aggregate_Bool_Exp>;
  total_balance?: InputMaybe<Numeric_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
  withheld_balance?: InputMaybe<Numeric_Comparison_Exp>;
};

/** unique or primary key constraints on table "accounts" */
export enum Accounts_Constraint {
  /** unique or primary key constraint on columns "id" */
  AccountsPkey = 'accounts_pkey',
  /** unique or primary key constraint on columns "currency", "user_id" */
  IdxAccountsUserCurrency = 'idx_accounts_user_currency'
}

/** input type for incrementing numeric columns in table "accounts" */
export type Accounts_Inc_Input = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Scalars['numeric']['input']>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "accounts" */
export type Accounts_Insert_Input = {
  account_transactions?: InputMaybe<Account_Transactions_Arr_Rel_Insert_Input>;
  /** Balance available for new orders */
  available_balance?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['currency_enum']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  mobile_payment_transactions?: InputMaybe<Mobile_Payment_Transactions_Arr_Rel_Insert_Input>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate max on columns */
export type Accounts_Max_Fields = {
  __typename?: 'accounts_max_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['numeric']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['currency_enum']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['numeric']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['numeric']['output']>;
};

/** order by max() on columns of table "accounts" */
export type Accounts_Max_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Accounts_Min_Fields = {
  __typename?: 'accounts_min_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['numeric']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['currency_enum']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['numeric']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['numeric']['output']>;
};

/** order by min() on columns of table "accounts" */
export type Accounts_Min_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "accounts" */
export type Accounts_Mutation_Response = {
  __typename?: 'accounts_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Accounts>;
};

/** input type for inserting object relation for remote table "accounts" */
export type Accounts_Obj_Rel_Insert_Input = {
  data: Accounts_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Accounts_On_Conflict>;
};

/** on_conflict condition type for table "accounts" */
export type Accounts_On_Conflict = {
  constraint: Accounts_Constraint;
  update_columns?: Array<Accounts_Update_Column>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};

/** Ordering options when selecting data from "accounts". */
export type Accounts_Order_By = {
  account_transactions_aggregate?: InputMaybe<Account_Transactions_Aggregate_Order_By>;
  available_balance?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_active?: InputMaybe<Order_By>;
  mobile_payment_transactions_aggregate?: InputMaybe<Mobile_Payment_Transactions_Aggregate_Order_By>;
  total_balance?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
  withheld_balance?: InputMaybe<Order_By>;
};

/** primary key columns input for table: accounts */
export type Accounts_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "accounts" */
export enum Accounts_Select_Column {
  /** column name */
  AvailableBalance = 'available_balance',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  TotalBalance = 'total_balance',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id',
  /** column name */
  WithheldBalance = 'withheld_balance'
}

/** select "accounts_aggregate_bool_exp_bool_and_arguments_columns" columns of table "accounts" */
export enum Accounts_Select_Column_Accounts_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsActive = 'is_active'
}

/** select "accounts_aggregate_bool_exp_bool_or_arguments_columns" columns of table "accounts" */
export enum Accounts_Select_Column_Accounts_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsActive = 'is_active'
}

/** input type for updating data in table "accounts" */
export type Accounts_Set_Input = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['currency_enum']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate stddev on columns */
export type Accounts_Stddev_Fields = {
  __typename?: 'accounts_stddev_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['Float']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['Float']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "accounts" */
export type Accounts_Stddev_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Accounts_Stddev_Pop_Fields = {
  __typename?: 'accounts_stddev_pop_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['Float']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['Float']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "accounts" */
export type Accounts_Stddev_Pop_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Accounts_Stddev_Samp_Fields = {
  __typename?: 'accounts_stddev_samp_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['Float']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['Float']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "accounts" */
export type Accounts_Stddev_Samp_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "accounts" */
export type Accounts_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Accounts_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Accounts_Stream_Cursor_Value_Input = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['currency_enum']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate sum on columns */
export type Accounts_Sum_Fields = {
  __typename?: 'accounts_sum_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['numeric']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['numeric']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "accounts" */
export type Accounts_Sum_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** update columns of table "accounts" */
export enum Accounts_Update_Column {
  /** column name */
  AvailableBalance = 'available_balance',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id',
  /** column name */
  WithheldBalance = 'withheld_balance'
}

export type Accounts_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Accounts_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Accounts_Set_Input>;
  /** filter the rows which have to be updated */
  where: Accounts_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Accounts_Var_Pop_Fields = {
  __typename?: 'accounts_var_pop_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['Float']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['Float']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "accounts" */
export type Accounts_Var_Pop_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Accounts_Var_Samp_Fields = {
  __typename?: 'accounts_var_samp_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['Float']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['Float']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "accounts" */
export type Accounts_Var_Samp_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Accounts_Variance_Fields = {
  __typename?: 'accounts_variance_fields';
  /** Balance available for new orders */
  available_balance?: Maybe<Scalars['Float']['output']>;
  /** Computed total balance (available + withheld) */
  total_balance?: Maybe<Scalars['Float']['output']>;
  /** Balance held for pending orders */
  withheld_balance?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "accounts" */
export type Accounts_Variance_Order_By = {
  /** Balance available for new orders */
  available_balance?: InputMaybe<Order_By>;
  /** Computed total balance (available + withheld) */
  total_balance?: InputMaybe<Order_By>;
  /** Balance held for pending orders */
  withheld_balance?: InputMaybe<Order_By>;
};

/** Polymorphic address table supporting multiple addresses for users and businesses */
export type Addresses = {
  __typename?: 'addresses';
  address_line_1: Scalars['String']['output'];
  address_line_2?: Maybe<Scalars['String']['output']>;
  /** Type of address (home, work, delivery, billing, etc.) */
  address_type?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  agent_addresses: Array<Agent_Addresses>;
  /** An aggregate relationship */
  agent_addresses_aggregate: Agent_Addresses_Aggregate;
  /** An array relationship */
  business_addresses: Array<Business_Addresses>;
  /** An aggregate relationship */
  business_addresses_aggregate: Business_Addresses_Aggregate;
  /** An object relationship */
  business_location?: Maybe<Business_Locations>;
  /** An array relationship */
  business_locations: Array<Business_Locations>;
  /** An aggregate relationship */
  business_locations_aggregate: Business_Locations_Aggregate;
  city: Scalars['String']['output'];
  /** An array relationship */
  client_addresses: Array<Client_Addresses>;
  /** An aggregate relationship */
  client_addresses_aggregate: Client_Addresses_Aggregate;
  country: Scalars['String']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id: Scalars['uuid']['output'];
  /** Whether this is the primary address for the entity */
  is_primary?: Maybe<Scalars['Boolean']['output']>;
  latitude?: Maybe<Scalars['numeric']['output']>;
  longitude?: Maybe<Scalars['numeric']['output']>;
  /** An array relationship */
  orders: Array<Orders>;
  /** An aggregate relationship */
  orders_aggregate: Orders_Aggregate;
  postal_code: Scalars['String']['output'];
  state: Scalars['String']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesAgent_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agent_Addresses_Order_By>>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesAgent_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agent_Addresses_Order_By>>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesBusiness_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Addresses_Order_By>>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesBusiness_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Addresses_Order_By>>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesBusiness_LocationsArgs = {
  distinct_on?: InputMaybe<Array<Business_Locations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Locations_Order_By>>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesBusiness_Locations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Locations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Locations_Order_By>>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesClient_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Client_Addresses_Order_By>>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesClient_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Client_Addresses_Order_By>>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesOrdersArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


/** Polymorphic address table supporting multiple addresses for users and businesses */
export type AddressesOrders_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};

/** aggregated selection of "addresses" */
export type Addresses_Aggregate = {
  __typename?: 'addresses_aggregate';
  aggregate?: Maybe<Addresses_Aggregate_Fields>;
  nodes: Array<Addresses>;
};

/** aggregate fields of "addresses" */
export type Addresses_Aggregate_Fields = {
  __typename?: 'addresses_aggregate_fields';
  avg?: Maybe<Addresses_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Addresses_Max_Fields>;
  min?: Maybe<Addresses_Min_Fields>;
  stddev?: Maybe<Addresses_Stddev_Fields>;
  stddev_pop?: Maybe<Addresses_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Addresses_Stddev_Samp_Fields>;
  sum?: Maybe<Addresses_Sum_Fields>;
  var_pop?: Maybe<Addresses_Var_Pop_Fields>;
  var_samp?: Maybe<Addresses_Var_Samp_Fields>;
  variance?: Maybe<Addresses_Variance_Fields>;
};


/** aggregate fields of "addresses" */
export type Addresses_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Addresses_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Addresses_Avg_Fields = {
  __typename?: 'addresses_avg_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "addresses". All fields are combined with a logical 'AND'. */
export type Addresses_Bool_Exp = {
  _and?: InputMaybe<Array<Addresses_Bool_Exp>>;
  _not?: InputMaybe<Addresses_Bool_Exp>;
  _or?: InputMaybe<Array<Addresses_Bool_Exp>>;
  address_line_1?: InputMaybe<String_Comparison_Exp>;
  address_line_2?: InputMaybe<String_Comparison_Exp>;
  address_type?: InputMaybe<String_Comparison_Exp>;
  agent_addresses?: InputMaybe<Agent_Addresses_Bool_Exp>;
  agent_addresses_aggregate?: InputMaybe<Agent_Addresses_Aggregate_Bool_Exp>;
  business_addresses?: InputMaybe<Business_Addresses_Bool_Exp>;
  business_addresses_aggregate?: InputMaybe<Business_Addresses_Aggregate_Bool_Exp>;
  business_location?: InputMaybe<Business_Locations_Bool_Exp>;
  business_locations?: InputMaybe<Business_Locations_Bool_Exp>;
  business_locations_aggregate?: InputMaybe<Business_Locations_Aggregate_Bool_Exp>;
  city?: InputMaybe<String_Comparison_Exp>;
  client_addresses?: InputMaybe<Client_Addresses_Bool_Exp>;
  client_addresses_aggregate?: InputMaybe<Client_Addresses_Aggregate_Bool_Exp>;
  country?: InputMaybe<String_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_primary?: InputMaybe<Boolean_Comparison_Exp>;
  latitude?: InputMaybe<Numeric_Comparison_Exp>;
  longitude?: InputMaybe<Numeric_Comparison_Exp>;
  orders?: InputMaybe<Orders_Bool_Exp>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Bool_Exp>;
  postal_code?: InputMaybe<String_Comparison_Exp>;
  state?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "addresses" */
export enum Addresses_Constraint {
  /** unique or primary key constraint on columns "id" */
  AddressesPkey = 'addresses_pkey'
}

/** input type for incrementing numeric columns in table "addresses" */
export type Addresses_Inc_Input = {
  latitude?: InputMaybe<Scalars['numeric']['input']>;
  longitude?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "addresses" */
export type Addresses_Insert_Input = {
  address_line_1?: InputMaybe<Scalars['String']['input']>;
  address_line_2?: InputMaybe<Scalars['String']['input']>;
  /** Type of address (home, work, delivery, billing, etc.) */
  address_type?: InputMaybe<Scalars['String']['input']>;
  agent_addresses?: InputMaybe<Agent_Addresses_Arr_Rel_Insert_Input>;
  business_addresses?: InputMaybe<Business_Addresses_Arr_Rel_Insert_Input>;
  business_location?: InputMaybe<Business_Locations_Obj_Rel_Insert_Input>;
  business_locations?: InputMaybe<Business_Locations_Arr_Rel_Insert_Input>;
  city?: InputMaybe<Scalars['String']['input']>;
  client_addresses?: InputMaybe<Client_Addresses_Arr_Rel_Insert_Input>;
  country?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Whether this is the primary address for the entity */
  is_primary?: InputMaybe<Scalars['Boolean']['input']>;
  latitude?: InputMaybe<Scalars['numeric']['input']>;
  longitude?: InputMaybe<Scalars['numeric']['input']>;
  orders?: InputMaybe<Orders_Arr_Rel_Insert_Input>;
  postal_code?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Addresses_Max_Fields = {
  __typename?: 'addresses_max_fields';
  address_line_1?: Maybe<Scalars['String']['output']>;
  address_line_2?: Maybe<Scalars['String']['output']>;
  /** Type of address (home, work, delivery, billing, etc.) */
  address_type?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  latitude?: Maybe<Scalars['numeric']['output']>;
  longitude?: Maybe<Scalars['numeric']['output']>;
  postal_code?: Maybe<Scalars['String']['output']>;
  state?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregate min on columns */
export type Addresses_Min_Fields = {
  __typename?: 'addresses_min_fields';
  address_line_1?: Maybe<Scalars['String']['output']>;
  address_line_2?: Maybe<Scalars['String']['output']>;
  /** Type of address (home, work, delivery, billing, etc.) */
  address_type?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  latitude?: Maybe<Scalars['numeric']['output']>;
  longitude?: Maybe<Scalars['numeric']['output']>;
  postal_code?: Maybe<Scalars['String']['output']>;
  state?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** response of any mutation on the table "addresses" */
export type Addresses_Mutation_Response = {
  __typename?: 'addresses_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Addresses>;
};

/** input type for inserting object relation for remote table "addresses" */
export type Addresses_Obj_Rel_Insert_Input = {
  data: Addresses_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Addresses_On_Conflict>;
};

/** on_conflict condition type for table "addresses" */
export type Addresses_On_Conflict = {
  constraint: Addresses_Constraint;
  update_columns?: Array<Addresses_Update_Column>;
  where?: InputMaybe<Addresses_Bool_Exp>;
};

/** Ordering options when selecting data from "addresses". */
export type Addresses_Order_By = {
  address_line_1?: InputMaybe<Order_By>;
  address_line_2?: InputMaybe<Order_By>;
  address_type?: InputMaybe<Order_By>;
  agent_addresses_aggregate?: InputMaybe<Agent_Addresses_Aggregate_Order_By>;
  business_addresses_aggregate?: InputMaybe<Business_Addresses_Aggregate_Order_By>;
  business_location?: InputMaybe<Business_Locations_Order_By>;
  business_locations_aggregate?: InputMaybe<Business_Locations_Aggregate_Order_By>;
  city?: InputMaybe<Order_By>;
  client_addresses_aggregate?: InputMaybe<Client_Addresses_Aggregate_Order_By>;
  country?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_primary?: InputMaybe<Order_By>;
  latitude?: InputMaybe<Order_By>;
  longitude?: InputMaybe<Order_By>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Order_By>;
  postal_code?: InputMaybe<Order_By>;
  state?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: addresses */
export type Addresses_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "addresses" */
export enum Addresses_Select_Column {
  /** column name */
  AddressLine_1 = 'address_line_1',
  /** column name */
  AddressLine_2 = 'address_line_2',
  /** column name */
  AddressType = 'address_type',
  /** column name */
  City = 'city',
  /** column name */
  Country = 'country',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsPrimary = 'is_primary',
  /** column name */
  Latitude = 'latitude',
  /** column name */
  Longitude = 'longitude',
  /** column name */
  PostalCode = 'postal_code',
  /** column name */
  State = 'state',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "addresses" */
export type Addresses_Set_Input = {
  address_line_1?: InputMaybe<Scalars['String']['input']>;
  address_line_2?: InputMaybe<Scalars['String']['input']>;
  /** Type of address (home, work, delivery, billing, etc.) */
  address_type?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Whether this is the primary address for the entity */
  is_primary?: InputMaybe<Scalars['Boolean']['input']>;
  latitude?: InputMaybe<Scalars['numeric']['input']>;
  longitude?: InputMaybe<Scalars['numeric']['input']>;
  postal_code?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Addresses_Stddev_Fields = {
  __typename?: 'addresses_stddev_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Addresses_Stddev_Pop_Fields = {
  __typename?: 'addresses_stddev_pop_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Addresses_Stddev_Samp_Fields = {
  __typename?: 'addresses_stddev_samp_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "addresses" */
export type Addresses_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Addresses_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Addresses_Stream_Cursor_Value_Input = {
  address_line_1?: InputMaybe<Scalars['String']['input']>;
  address_line_2?: InputMaybe<Scalars['String']['input']>;
  /** Type of address (home, work, delivery, billing, etc.) */
  address_type?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Whether this is the primary address for the entity */
  is_primary?: InputMaybe<Scalars['Boolean']['input']>;
  latitude?: InputMaybe<Scalars['numeric']['input']>;
  longitude?: InputMaybe<Scalars['numeric']['input']>;
  postal_code?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Addresses_Sum_Fields = {
  __typename?: 'addresses_sum_fields';
  latitude?: Maybe<Scalars['numeric']['output']>;
  longitude?: Maybe<Scalars['numeric']['output']>;
};

/** update columns of table "addresses" */
export enum Addresses_Update_Column {
  /** column name */
  AddressLine_1 = 'address_line_1',
  /** column name */
  AddressLine_2 = 'address_line_2',
  /** column name */
  AddressType = 'address_type',
  /** column name */
  City = 'city',
  /** column name */
  Country = 'country',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsPrimary = 'is_primary',
  /** column name */
  Latitude = 'latitude',
  /** column name */
  Longitude = 'longitude',
  /** column name */
  PostalCode = 'postal_code',
  /** column name */
  State = 'state',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Addresses_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Addresses_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Addresses_Set_Input>;
  /** filter the rows which have to be updated */
  where: Addresses_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Addresses_Var_Pop_Fields = {
  __typename?: 'addresses_var_pop_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Addresses_Var_Samp_Fields = {
  __typename?: 'addresses_var_samp_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Addresses_Variance_Fields = {
  __typename?: 'addresses_variance_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "agent_addresses" */
export type Agent_Addresses = {
  __typename?: 'agent_addresses';
  /** An object relationship */
  address: Addresses;
  address_id: Scalars['uuid']['output'];
  /** An object relationship */
  agent: Agents;
  agent_id: Scalars['uuid']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id: Scalars['uuid']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregated selection of "agent_addresses" */
export type Agent_Addresses_Aggregate = {
  __typename?: 'agent_addresses_aggregate';
  aggregate?: Maybe<Agent_Addresses_Aggregate_Fields>;
  nodes: Array<Agent_Addresses>;
};

export type Agent_Addresses_Aggregate_Bool_Exp = {
  count?: InputMaybe<Agent_Addresses_Aggregate_Bool_Exp_Count>;
};

export type Agent_Addresses_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Agent_Addresses_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "agent_addresses" */
export type Agent_Addresses_Aggregate_Fields = {
  __typename?: 'agent_addresses_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Agent_Addresses_Max_Fields>;
  min?: Maybe<Agent_Addresses_Min_Fields>;
};


/** aggregate fields of "agent_addresses" */
export type Agent_Addresses_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "agent_addresses" */
export type Agent_Addresses_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Agent_Addresses_Max_Order_By>;
  min?: InputMaybe<Agent_Addresses_Min_Order_By>;
};

/** input type for inserting array relation for remote table "agent_addresses" */
export type Agent_Addresses_Arr_Rel_Insert_Input = {
  data: Array<Agent_Addresses_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Agent_Addresses_On_Conflict>;
};

/** Boolean expression to filter rows from the table "agent_addresses". All fields are combined with a logical 'AND'. */
export type Agent_Addresses_Bool_Exp = {
  _and?: InputMaybe<Array<Agent_Addresses_Bool_Exp>>;
  _not?: InputMaybe<Agent_Addresses_Bool_Exp>;
  _or?: InputMaybe<Array<Agent_Addresses_Bool_Exp>>;
  address?: InputMaybe<Addresses_Bool_Exp>;
  address_id?: InputMaybe<Uuid_Comparison_Exp>;
  agent?: InputMaybe<Agents_Bool_Exp>;
  agent_id?: InputMaybe<Uuid_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "agent_addresses" */
export enum Agent_Addresses_Constraint {
  /** unique or primary key constraint on columns "id" */
  AgentAddressesPkey = 'agent_addresses_pkey',
  /** unique or primary key constraint on columns "address_id" */
  UniqueAgentAddressAddressId = 'unique_agent_address_address_id'
}

/** input type for inserting data into table "agent_addresses" */
export type Agent_Addresses_Insert_Input = {
  address?: InputMaybe<Addresses_Obj_Rel_Insert_Input>;
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  agent?: InputMaybe<Agents_Obj_Rel_Insert_Input>;
  agent_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Agent_Addresses_Max_Fields = {
  __typename?: 'agent_addresses_max_fields';
  address_id?: Maybe<Scalars['uuid']['output']>;
  agent_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "agent_addresses" */
export type Agent_Addresses_Max_Order_By = {
  address_id?: InputMaybe<Order_By>;
  agent_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Agent_Addresses_Min_Fields = {
  __typename?: 'agent_addresses_min_fields';
  address_id?: Maybe<Scalars['uuid']['output']>;
  agent_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "agent_addresses" */
export type Agent_Addresses_Min_Order_By = {
  address_id?: InputMaybe<Order_By>;
  agent_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "agent_addresses" */
export type Agent_Addresses_Mutation_Response = {
  __typename?: 'agent_addresses_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Agent_Addresses>;
};

/** on_conflict condition type for table "agent_addresses" */
export type Agent_Addresses_On_Conflict = {
  constraint: Agent_Addresses_Constraint;
  update_columns?: Array<Agent_Addresses_Update_Column>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};

/** Ordering options when selecting data from "agent_addresses". */
export type Agent_Addresses_Order_By = {
  address?: InputMaybe<Addresses_Order_By>;
  address_id?: InputMaybe<Order_By>;
  agent?: InputMaybe<Agents_Order_By>;
  agent_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: agent_addresses */
export type Agent_Addresses_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "agent_addresses" */
export enum Agent_Addresses_Select_Column {
  /** column name */
  AddressId = 'address_id',
  /** column name */
  AgentId = 'agent_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "agent_addresses" */
export type Agent_Addresses_Set_Input = {
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  agent_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** Streaming cursor of the table "agent_addresses" */
export type Agent_Addresses_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Agent_Addresses_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Agent_Addresses_Stream_Cursor_Value_Input = {
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  agent_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** update columns of table "agent_addresses" */
export enum Agent_Addresses_Update_Column {
  /** column name */
  AddressId = 'address_id',
  /** column name */
  AgentId = 'agent_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Agent_Addresses_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Agent_Addresses_Set_Input>;
  /** filter the rows which have to be updated */
  where: Agent_Addresses_Bool_Exp;
};

/** columns and relationships of "agents" */
export type Agents = {
  __typename?: 'agents';
  /** An array relationship */
  agent_addresses: Array<Agent_Addresses>;
  /** An aggregate relationship */
  agent_addresses_aggregate: Agent_Addresses_Aggregate;
  created_at: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  /** Indicates if the agent account has been verified */
  is_verified?: Maybe<Scalars['Boolean']['output']>;
  /** An array relationship */
  order_holds: Array<Order_Holds>;
  /** An aggregate relationship */
  order_holds_aggregate: Order_Holds_Aggregate;
  /** An array relationship */
  orders: Array<Orders>;
  /** An aggregate relationship */
  orders_aggregate: Orders_Aggregate;
  /** An array relationship */
  ratings_received: Array<Ratings>;
  /** An aggregate relationship */
  ratings_received_aggregate: Ratings_Aggregate;
  updated_at: Scalars['timestamptz']['output'];
  /** An object relationship */
  user: Users;
  user_id: Scalars['uuid']['output'];
  /** An object relationship */
  vehicle_type: Vehicle_Types;
  vehicle_type_id: Vehicle_Types_Enum;
};


/** columns and relationships of "agents" */
export type AgentsAgent_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agent_Addresses_Order_By>>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};


/** columns and relationships of "agents" */
export type AgentsAgent_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agent_Addresses_Order_By>>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};


/** columns and relationships of "agents" */
export type AgentsOrder_HoldsArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


/** columns and relationships of "agents" */
export type AgentsOrder_Holds_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


/** columns and relationships of "agents" */
export type AgentsOrdersArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


/** columns and relationships of "agents" */
export type AgentsOrders_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


/** columns and relationships of "agents" */
export type AgentsRatings_ReceivedArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


/** columns and relationships of "agents" */
export type AgentsRatings_Received_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};

/** aggregated selection of "agents" */
export type Agents_Aggregate = {
  __typename?: 'agents_aggregate';
  aggregate?: Maybe<Agents_Aggregate_Fields>;
  nodes: Array<Agents>;
};

export type Agents_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Agents_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Agents_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Agents_Aggregate_Bool_Exp_Count>;
};

export type Agents_Aggregate_Bool_Exp_Bool_And = {
  arguments: Agents_Select_Column_Agents_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Agents_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Agents_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Agents_Select_Column_Agents_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Agents_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Agents_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Agents_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Agents_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "agents" */
export type Agents_Aggregate_Fields = {
  __typename?: 'agents_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Agents_Max_Fields>;
  min?: Maybe<Agents_Min_Fields>;
};


/** aggregate fields of "agents" */
export type Agents_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Agents_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "agents" */
export type Agents_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Agents_Max_Order_By>;
  min?: InputMaybe<Agents_Min_Order_By>;
};

/** input type for inserting array relation for remote table "agents" */
export type Agents_Arr_Rel_Insert_Input = {
  data: Array<Agents_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Agents_On_Conflict>;
};

/** Boolean expression to filter rows from the table "agents". All fields are combined with a logical 'AND'. */
export type Agents_Bool_Exp = {
  _and?: InputMaybe<Array<Agents_Bool_Exp>>;
  _not?: InputMaybe<Agents_Bool_Exp>;
  _or?: InputMaybe<Array<Agents_Bool_Exp>>;
  agent_addresses?: InputMaybe<Agent_Addresses_Bool_Exp>;
  agent_addresses_aggregate?: InputMaybe<Agent_Addresses_Aggregate_Bool_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_verified?: InputMaybe<Boolean_Comparison_Exp>;
  order_holds?: InputMaybe<Order_Holds_Bool_Exp>;
  order_holds_aggregate?: InputMaybe<Order_Holds_Aggregate_Bool_Exp>;
  orders?: InputMaybe<Orders_Bool_Exp>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Bool_Exp>;
  ratings_received?: InputMaybe<Ratings_Bool_Exp>;
  ratings_received_aggregate?: InputMaybe<Ratings_Aggregate_Bool_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
  vehicle_type?: InputMaybe<Vehicle_Types_Bool_Exp>;
  vehicle_type_id?: InputMaybe<Vehicle_Types_Enum_Comparison_Exp>;
};

/** unique or primary key constraints on table "agents" */
export enum Agents_Constraint {
  /** unique or primary key constraint on columns "id" */
  AgentsPkey = 'agents_pkey',
  /** unique or primary key constraint on columns "user_id" */
  AgentsUserIdKey = 'agents_user_id_key'
}

/** input type for inserting data into table "agents" */
export type Agents_Insert_Input = {
  agent_addresses?: InputMaybe<Agent_Addresses_Arr_Rel_Insert_Input>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Indicates if the agent account has been verified */
  is_verified?: InputMaybe<Scalars['Boolean']['input']>;
  order_holds?: InputMaybe<Order_Holds_Arr_Rel_Insert_Input>;
  orders?: InputMaybe<Orders_Arr_Rel_Insert_Input>;
  ratings_received?: InputMaybe<Ratings_Arr_Rel_Insert_Input>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
  vehicle_type?: InputMaybe<Vehicle_Types_Obj_Rel_Insert_Input>;
  vehicle_type_id?: InputMaybe<Vehicle_Types_Enum>;
};

/** aggregate max on columns */
export type Agents_Max_Fields = {
  __typename?: 'agents_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "agents" */
export type Agents_Max_Order_By = {
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Agents_Min_Fields = {
  __typename?: 'agents_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "agents" */
export type Agents_Min_Order_By = {
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "agents" */
export type Agents_Mutation_Response = {
  __typename?: 'agents_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Agents>;
};

/** input type for inserting object relation for remote table "agents" */
export type Agents_Obj_Rel_Insert_Input = {
  data: Agents_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Agents_On_Conflict>;
};

/** on_conflict condition type for table "agents" */
export type Agents_On_Conflict = {
  constraint: Agents_Constraint;
  update_columns?: Array<Agents_Update_Column>;
  where?: InputMaybe<Agents_Bool_Exp>;
};

/** Ordering options when selecting data from "agents". */
export type Agents_Order_By = {
  agent_addresses_aggregate?: InputMaybe<Agent_Addresses_Aggregate_Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_verified?: InputMaybe<Order_By>;
  order_holds_aggregate?: InputMaybe<Order_Holds_Aggregate_Order_By>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Order_By>;
  ratings_received_aggregate?: InputMaybe<Ratings_Aggregate_Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
  vehicle_type?: InputMaybe<Vehicle_Types_Order_By>;
  vehicle_type_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: agents */
export type Agents_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "agents" */
export enum Agents_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsVerified = 'is_verified',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id',
  /** column name */
  VehicleTypeId = 'vehicle_type_id'
}

/** select "agents_aggregate_bool_exp_bool_and_arguments_columns" columns of table "agents" */
export enum Agents_Select_Column_Agents_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsVerified = 'is_verified'
}

/** select "agents_aggregate_bool_exp_bool_or_arguments_columns" columns of table "agents" */
export enum Agents_Select_Column_Agents_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsVerified = 'is_verified'
}

/** input type for updating data in table "agents" */
export type Agents_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Indicates if the agent account has been verified */
  is_verified?: InputMaybe<Scalars['Boolean']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
  vehicle_type_id?: InputMaybe<Vehicle_Types_Enum>;
};

/** Streaming cursor of the table "agents" */
export type Agents_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Agents_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Agents_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Indicates if the agent account has been verified */
  is_verified?: InputMaybe<Scalars['Boolean']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
  vehicle_type_id?: InputMaybe<Vehicle_Types_Enum>;
};

/** update columns of table "agents" */
export enum Agents_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsVerified = 'is_verified',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id',
  /** column name */
  VehicleTypeId = 'vehicle_type_id'
}

export type Agents_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Agents_Set_Input>;
  /** filter the rows which have to be updated */
  where: Agents_Bool_Exp;
};

/** columns and relationships of "airtel_money_payments" */
export type Airtel_Money_Payments = {
  __typename?: 'airtel_money_payments';
  amount: Scalars['String']['output'];
  callback_data?: Maybe<Scalars['jsonb']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency: Scalars['String']['output'];
  id: Scalars['uuid']['output'];
  message?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  reference: Scalars['String']['output'];
  status: Scalars['String']['output'];
  transaction_id: Scalars['String']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  /** An object relationship */
  user?: Maybe<Users>;
  user_id: Scalars['uuid']['output'];
};


/** columns and relationships of "airtel_money_payments" */
export type Airtel_Money_PaymentsCallback_DataArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "airtel_money_payments" */
export type Airtel_Money_Payments_Aggregate = {
  __typename?: 'airtel_money_payments_aggregate';
  aggregate?: Maybe<Airtel_Money_Payments_Aggregate_Fields>;
  nodes: Array<Airtel_Money_Payments>;
};

export type Airtel_Money_Payments_Aggregate_Bool_Exp = {
  count?: InputMaybe<Airtel_Money_Payments_Aggregate_Bool_Exp_Count>;
};

export type Airtel_Money_Payments_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Airtel_Money_Payments_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "airtel_money_payments" */
export type Airtel_Money_Payments_Aggregate_Fields = {
  __typename?: 'airtel_money_payments_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Airtel_Money_Payments_Max_Fields>;
  min?: Maybe<Airtel_Money_Payments_Min_Fields>;
};


/** aggregate fields of "airtel_money_payments" */
export type Airtel_Money_Payments_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Airtel_Money_Payments_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "airtel_money_payments" */
export type Airtel_Money_Payments_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Airtel_Money_Payments_Max_Order_By>;
  min?: InputMaybe<Airtel_Money_Payments_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Airtel_Money_Payments_Append_Input = {
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
};

/** input type for inserting array relation for remote table "airtel_money_payments" */
export type Airtel_Money_Payments_Arr_Rel_Insert_Input = {
  data: Array<Airtel_Money_Payments_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Airtel_Money_Payments_On_Conflict>;
};

/** Boolean expression to filter rows from the table "airtel_money_payments". All fields are combined with a logical 'AND'. */
export type Airtel_Money_Payments_Bool_Exp = {
  _and?: InputMaybe<Array<Airtel_Money_Payments_Bool_Exp>>;
  _not?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
  _or?: InputMaybe<Array<Airtel_Money_Payments_Bool_Exp>>;
  amount?: InputMaybe<String_Comparison_Exp>;
  callback_data?: InputMaybe<Jsonb_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  message?: InputMaybe<String_Comparison_Exp>;
  notes?: InputMaybe<String_Comparison_Exp>;
  reference?: InputMaybe<String_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  transaction_id?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "airtel_money_payments" */
export enum Airtel_Money_Payments_Constraint {
  /** unique or primary key constraint on columns "id" */
  AirtelMoneyPaymentsPkey = 'airtel_money_payments_pkey',
  /** unique or primary key constraint on columns "transaction_id" */
  AirtelMoneyPaymentsTransactionIdKey = 'airtel_money_payments_transaction_id_key'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Airtel_Money_Payments_Delete_At_Path_Input = {
  callback_data?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Airtel_Money_Payments_Delete_Elem_Input = {
  callback_data?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Airtel_Money_Payments_Delete_Key_Input = {
  callback_data?: InputMaybe<Scalars['String']['input']>;
};

/** input type for inserting data into table "airtel_money_payments" */
export type Airtel_Money_Payments_Insert_Input = {
  amount?: InputMaybe<Scalars['String']['input']>;
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  reference?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transaction_id?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type Airtel_Money_Payments_Max_Fields = {
  __typename?: 'airtel_money_payments_max_fields';
  amount?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  reference?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  transaction_id?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "airtel_money_payments" */
export type Airtel_Money_Payments_Max_Order_By = {
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  reference?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Airtel_Money_Payments_Min_Fields = {
  __typename?: 'airtel_money_payments_min_fields';
  amount?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  reference?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  transaction_id?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "airtel_money_payments" */
export type Airtel_Money_Payments_Min_Order_By = {
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  reference?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "airtel_money_payments" */
export type Airtel_Money_Payments_Mutation_Response = {
  __typename?: 'airtel_money_payments_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Airtel_Money_Payments>;
};

/** on_conflict condition type for table "airtel_money_payments" */
export type Airtel_Money_Payments_On_Conflict = {
  constraint: Airtel_Money_Payments_Constraint;
  update_columns?: Array<Airtel_Money_Payments_Update_Column>;
  where?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
};

/** Ordering options when selecting data from "airtel_money_payments". */
export type Airtel_Money_Payments_Order_By = {
  amount?: InputMaybe<Order_By>;
  callback_data?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  reference?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: airtel_money_payments */
export type Airtel_Money_Payments_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Airtel_Money_Payments_Prepend_Input = {
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "airtel_money_payments" */
export enum Airtel_Money_Payments_Select_Column {
  /** column name */
  Amount = 'amount',
  /** column name */
  CallbackData = 'callback_data',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message',
  /** column name */
  Notes = 'notes',
  /** column name */
  Reference = 'reference',
  /** column name */
  Status = 'status',
  /** column name */
  TransactionId = 'transaction_id',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

/** input type for updating data in table "airtel_money_payments" */
export type Airtel_Money_Payments_Set_Input = {
  amount?: InputMaybe<Scalars['String']['input']>;
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  reference?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transaction_id?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** Streaming cursor of the table "airtel_money_payments" */
export type Airtel_Money_Payments_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Airtel_Money_Payments_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Airtel_Money_Payments_Stream_Cursor_Value_Input = {
  amount?: InputMaybe<Scalars['String']['input']>;
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  reference?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transaction_id?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "airtel_money_payments" */
export enum Airtel_Money_Payments_Update_Column {
  /** column name */
  Amount = 'amount',
  /** column name */
  CallbackData = 'callback_data',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message',
  /** column name */
  Notes = 'notes',
  /** column name */
  Reference = 'reference',
  /** column name */
  Status = 'status',
  /** column name */
  TransactionId = 'transaction_id',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

export type Airtel_Money_Payments_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Airtel_Money_Payments_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Airtel_Money_Payments_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Airtel_Money_Payments_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Airtel_Money_Payments_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Airtel_Money_Payments_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Airtel_Money_Payments_Set_Input>;
  /** filter the rows which have to be updated */
  where: Airtel_Money_Payments_Bool_Exp;
};

/** Global application configuration settings including fast delivery parameters */
export type Application_Configurations = {
  __typename?: 'application_configurations';
  allowed_values?: Maybe<Array<Scalars['String']['output']>>;
  array_value?: Maybe<Array<Scalars['String']['output']>>;
  boolean_value?: Maybe<Scalars['Boolean']['output']>;
  config_key: Scalars['String']['output'];
  config_name: Scalars['String']['output'];
  country_code?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  created_by?: Maybe<Scalars['uuid']['output']>;
  data_type: Scalars['String']['output'];
  date_value?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  json_value?: Maybe<Scalars['jsonb']['output']>;
  max_value?: Maybe<Scalars['numeric']['output']>;
  min_value?: Maybe<Scalars['numeric']['output']>;
  number_value?: Maybe<Scalars['numeric']['output']>;
  status: Scalars['String']['output'];
  string_value?: Maybe<Scalars['String']['output']>;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  updated_by?: Maybe<Scalars['uuid']['output']>;
  validation_rules?: Maybe<Scalars['jsonb']['output']>;
  version: Scalars['Int']['output'];
};


/** Global application configuration settings including fast delivery parameters */
export type Application_ConfigurationsJson_ValueArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};


/** Global application configuration settings including fast delivery parameters */
export type Application_ConfigurationsValidation_RulesArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "application_configurations" */
export type Application_Configurations_Aggregate = {
  __typename?: 'application_configurations_aggregate';
  aggregate?: Maybe<Application_Configurations_Aggregate_Fields>;
  nodes: Array<Application_Configurations>;
};

/** aggregate fields of "application_configurations" */
export type Application_Configurations_Aggregate_Fields = {
  __typename?: 'application_configurations_aggregate_fields';
  avg?: Maybe<Application_Configurations_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Application_Configurations_Max_Fields>;
  min?: Maybe<Application_Configurations_Min_Fields>;
  stddev?: Maybe<Application_Configurations_Stddev_Fields>;
  stddev_pop?: Maybe<Application_Configurations_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Application_Configurations_Stddev_Samp_Fields>;
  sum?: Maybe<Application_Configurations_Sum_Fields>;
  var_pop?: Maybe<Application_Configurations_Var_Pop_Fields>;
  var_samp?: Maybe<Application_Configurations_Var_Samp_Fields>;
  variance?: Maybe<Application_Configurations_Variance_Fields>;
};


/** aggregate fields of "application_configurations" */
export type Application_Configurations_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Application_Configurations_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Application_Configurations_Append_Input = {
  json_value?: InputMaybe<Scalars['jsonb']['input']>;
  validation_rules?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate avg on columns */
export type Application_Configurations_Avg_Fields = {
  __typename?: 'application_configurations_avg_fields';
  max_value?: Maybe<Scalars['Float']['output']>;
  min_value?: Maybe<Scalars['Float']['output']>;
  number_value?: Maybe<Scalars['Float']['output']>;
  version?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "application_configurations". All fields are combined with a logical 'AND'. */
export type Application_Configurations_Bool_Exp = {
  _and?: InputMaybe<Array<Application_Configurations_Bool_Exp>>;
  _not?: InputMaybe<Application_Configurations_Bool_Exp>;
  _or?: InputMaybe<Array<Application_Configurations_Bool_Exp>>;
  allowed_values?: InputMaybe<String_Array_Comparison_Exp>;
  array_value?: InputMaybe<String_Array_Comparison_Exp>;
  boolean_value?: InputMaybe<Boolean_Comparison_Exp>;
  config_key?: InputMaybe<String_Comparison_Exp>;
  config_name?: InputMaybe<String_Comparison_Exp>;
  country_code?: InputMaybe<String_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  created_by?: InputMaybe<Uuid_Comparison_Exp>;
  data_type?: InputMaybe<String_Comparison_Exp>;
  date_value?: InputMaybe<Timestamptz_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  json_value?: InputMaybe<Jsonb_Comparison_Exp>;
  max_value?: InputMaybe<Numeric_Comparison_Exp>;
  min_value?: InputMaybe<Numeric_Comparison_Exp>;
  number_value?: InputMaybe<Numeric_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  string_value?: InputMaybe<String_Comparison_Exp>;
  tags?: InputMaybe<String_Array_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  updated_by?: InputMaybe<Uuid_Comparison_Exp>;
  validation_rules?: InputMaybe<Jsonb_Comparison_Exp>;
  version?: InputMaybe<Int_Comparison_Exp>;
};

/** unique or primary key constraints on table "application_configurations" */
export enum Application_Configurations_Constraint {
  /** unique or primary key constraint on columns "id" */
  ApplicationConfigurationsPkey = 'application_configurations_pkey',
  /** unique or primary key constraint on columns "country_code", "config_key" */
  UniqueConfigKeyCountry = 'unique_config_key_country'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Application_Configurations_Delete_At_Path_Input = {
  json_value?: InputMaybe<Array<Scalars['String']['input']>>;
  validation_rules?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Application_Configurations_Delete_Elem_Input = {
  json_value?: InputMaybe<Scalars['Int']['input']>;
  validation_rules?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Application_Configurations_Delete_Key_Input = {
  json_value?: InputMaybe<Scalars['String']['input']>;
  validation_rules?: InputMaybe<Scalars['String']['input']>;
};

/** input type for incrementing numeric columns in table "application_configurations" */
export type Application_Configurations_Inc_Input = {
  max_value?: InputMaybe<Scalars['numeric']['input']>;
  min_value?: InputMaybe<Scalars['numeric']['input']>;
  number_value?: InputMaybe<Scalars['numeric']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "application_configurations" */
export type Application_Configurations_Insert_Input = {
  allowed_values?: InputMaybe<Array<Scalars['String']['input']>>;
  array_value?: InputMaybe<Array<Scalars['String']['input']>>;
  boolean_value?: InputMaybe<Scalars['Boolean']['input']>;
  config_key?: InputMaybe<Scalars['String']['input']>;
  config_name?: InputMaybe<Scalars['String']['input']>;
  country_code?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  created_by?: InputMaybe<Scalars['uuid']['input']>;
  data_type?: InputMaybe<Scalars['String']['input']>;
  date_value?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  json_value?: InputMaybe<Scalars['jsonb']['input']>;
  max_value?: InputMaybe<Scalars['numeric']['input']>;
  min_value?: InputMaybe<Scalars['numeric']['input']>;
  number_value?: InputMaybe<Scalars['numeric']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  string_value?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  updated_by?: InputMaybe<Scalars['uuid']['input']>;
  validation_rules?: InputMaybe<Scalars['jsonb']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate max on columns */
export type Application_Configurations_Max_Fields = {
  __typename?: 'application_configurations_max_fields';
  allowed_values?: Maybe<Array<Scalars['String']['output']>>;
  array_value?: Maybe<Array<Scalars['String']['output']>>;
  config_key?: Maybe<Scalars['String']['output']>;
  config_name?: Maybe<Scalars['String']['output']>;
  country_code?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  created_by?: Maybe<Scalars['uuid']['output']>;
  data_type?: Maybe<Scalars['String']['output']>;
  date_value?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  max_value?: Maybe<Scalars['numeric']['output']>;
  min_value?: Maybe<Scalars['numeric']['output']>;
  number_value?: Maybe<Scalars['numeric']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  string_value?: Maybe<Scalars['String']['output']>;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  updated_by?: Maybe<Scalars['uuid']['output']>;
  version?: Maybe<Scalars['Int']['output']>;
};

/** aggregate min on columns */
export type Application_Configurations_Min_Fields = {
  __typename?: 'application_configurations_min_fields';
  allowed_values?: Maybe<Array<Scalars['String']['output']>>;
  array_value?: Maybe<Array<Scalars['String']['output']>>;
  config_key?: Maybe<Scalars['String']['output']>;
  config_name?: Maybe<Scalars['String']['output']>;
  country_code?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  created_by?: Maybe<Scalars['uuid']['output']>;
  data_type?: Maybe<Scalars['String']['output']>;
  date_value?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  max_value?: Maybe<Scalars['numeric']['output']>;
  min_value?: Maybe<Scalars['numeric']['output']>;
  number_value?: Maybe<Scalars['numeric']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  string_value?: Maybe<Scalars['String']['output']>;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  updated_by?: Maybe<Scalars['uuid']['output']>;
  version?: Maybe<Scalars['Int']['output']>;
};

/** response of any mutation on the table "application_configurations" */
export type Application_Configurations_Mutation_Response = {
  __typename?: 'application_configurations_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Application_Configurations>;
};

/** on_conflict condition type for table "application_configurations" */
export type Application_Configurations_On_Conflict = {
  constraint: Application_Configurations_Constraint;
  update_columns?: Array<Application_Configurations_Update_Column>;
  where?: InputMaybe<Application_Configurations_Bool_Exp>;
};

/** Ordering options when selecting data from "application_configurations". */
export type Application_Configurations_Order_By = {
  allowed_values?: InputMaybe<Order_By>;
  array_value?: InputMaybe<Order_By>;
  boolean_value?: InputMaybe<Order_By>;
  config_key?: InputMaybe<Order_By>;
  config_name?: InputMaybe<Order_By>;
  country_code?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  created_by?: InputMaybe<Order_By>;
  data_type?: InputMaybe<Order_By>;
  date_value?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  json_value?: InputMaybe<Order_By>;
  max_value?: InputMaybe<Order_By>;
  min_value?: InputMaybe<Order_By>;
  number_value?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  string_value?: InputMaybe<Order_By>;
  tags?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  updated_by?: InputMaybe<Order_By>;
  validation_rules?: InputMaybe<Order_By>;
  version?: InputMaybe<Order_By>;
};

/** primary key columns input for table: application_configurations */
export type Application_Configurations_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Application_Configurations_Prepend_Input = {
  json_value?: InputMaybe<Scalars['jsonb']['input']>;
  validation_rules?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "application_configurations" */
export enum Application_Configurations_Select_Column {
  /** column name */
  AllowedValues = 'allowed_values',
  /** column name */
  ArrayValue = 'array_value',
  /** column name */
  BooleanValue = 'boolean_value',
  /** column name */
  ConfigKey = 'config_key',
  /** column name */
  ConfigName = 'config_name',
  /** column name */
  CountryCode = 'country_code',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  CreatedBy = 'created_by',
  /** column name */
  DataType = 'data_type',
  /** column name */
  DateValue = 'date_value',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  JsonValue = 'json_value',
  /** column name */
  MaxValue = 'max_value',
  /** column name */
  MinValue = 'min_value',
  /** column name */
  NumberValue = 'number_value',
  /** column name */
  Status = 'status',
  /** column name */
  StringValue = 'string_value',
  /** column name */
  Tags = 'tags',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UpdatedBy = 'updated_by',
  /** column name */
  ValidationRules = 'validation_rules',
  /** column name */
  Version = 'version'
}

/** input type for updating data in table "application_configurations" */
export type Application_Configurations_Set_Input = {
  allowed_values?: InputMaybe<Array<Scalars['String']['input']>>;
  array_value?: InputMaybe<Array<Scalars['String']['input']>>;
  boolean_value?: InputMaybe<Scalars['Boolean']['input']>;
  config_key?: InputMaybe<Scalars['String']['input']>;
  config_name?: InputMaybe<Scalars['String']['input']>;
  country_code?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  created_by?: InputMaybe<Scalars['uuid']['input']>;
  data_type?: InputMaybe<Scalars['String']['input']>;
  date_value?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  json_value?: InputMaybe<Scalars['jsonb']['input']>;
  max_value?: InputMaybe<Scalars['numeric']['input']>;
  min_value?: InputMaybe<Scalars['numeric']['input']>;
  number_value?: InputMaybe<Scalars['numeric']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  string_value?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  updated_by?: InputMaybe<Scalars['uuid']['input']>;
  validation_rules?: InputMaybe<Scalars['jsonb']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate stddev on columns */
export type Application_Configurations_Stddev_Fields = {
  __typename?: 'application_configurations_stddev_fields';
  max_value?: Maybe<Scalars['Float']['output']>;
  min_value?: Maybe<Scalars['Float']['output']>;
  number_value?: Maybe<Scalars['Float']['output']>;
  version?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Application_Configurations_Stddev_Pop_Fields = {
  __typename?: 'application_configurations_stddev_pop_fields';
  max_value?: Maybe<Scalars['Float']['output']>;
  min_value?: Maybe<Scalars['Float']['output']>;
  number_value?: Maybe<Scalars['Float']['output']>;
  version?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Application_Configurations_Stddev_Samp_Fields = {
  __typename?: 'application_configurations_stddev_samp_fields';
  max_value?: Maybe<Scalars['Float']['output']>;
  min_value?: Maybe<Scalars['Float']['output']>;
  number_value?: Maybe<Scalars['Float']['output']>;
  version?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "application_configurations" */
export type Application_Configurations_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Application_Configurations_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Application_Configurations_Stream_Cursor_Value_Input = {
  allowed_values?: InputMaybe<Array<Scalars['String']['input']>>;
  array_value?: InputMaybe<Array<Scalars['String']['input']>>;
  boolean_value?: InputMaybe<Scalars['Boolean']['input']>;
  config_key?: InputMaybe<Scalars['String']['input']>;
  config_name?: InputMaybe<Scalars['String']['input']>;
  country_code?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  created_by?: InputMaybe<Scalars['uuid']['input']>;
  data_type?: InputMaybe<Scalars['String']['input']>;
  date_value?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  json_value?: InputMaybe<Scalars['jsonb']['input']>;
  max_value?: InputMaybe<Scalars['numeric']['input']>;
  min_value?: InputMaybe<Scalars['numeric']['input']>;
  number_value?: InputMaybe<Scalars['numeric']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  string_value?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  updated_by?: InputMaybe<Scalars['uuid']['input']>;
  validation_rules?: InputMaybe<Scalars['jsonb']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate sum on columns */
export type Application_Configurations_Sum_Fields = {
  __typename?: 'application_configurations_sum_fields';
  max_value?: Maybe<Scalars['numeric']['output']>;
  min_value?: Maybe<Scalars['numeric']['output']>;
  number_value?: Maybe<Scalars['numeric']['output']>;
  version?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "application_configurations" */
export enum Application_Configurations_Update_Column {
  /** column name */
  AllowedValues = 'allowed_values',
  /** column name */
  ArrayValue = 'array_value',
  /** column name */
  BooleanValue = 'boolean_value',
  /** column name */
  ConfigKey = 'config_key',
  /** column name */
  ConfigName = 'config_name',
  /** column name */
  CountryCode = 'country_code',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  CreatedBy = 'created_by',
  /** column name */
  DataType = 'data_type',
  /** column name */
  DateValue = 'date_value',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  JsonValue = 'json_value',
  /** column name */
  MaxValue = 'max_value',
  /** column name */
  MinValue = 'min_value',
  /** column name */
  NumberValue = 'number_value',
  /** column name */
  Status = 'status',
  /** column name */
  StringValue = 'string_value',
  /** column name */
  Tags = 'tags',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UpdatedBy = 'updated_by',
  /** column name */
  ValidationRules = 'validation_rules',
  /** column name */
  Version = 'version'
}

export type Application_Configurations_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Application_Configurations_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Application_Configurations_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Application_Configurations_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Application_Configurations_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Application_Configurations_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Application_Configurations_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Application_Configurations_Set_Input>;
  /** filter the rows which have to be updated */
  where: Application_Configurations_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Application_Configurations_Var_Pop_Fields = {
  __typename?: 'application_configurations_var_pop_fields';
  max_value?: Maybe<Scalars['Float']['output']>;
  min_value?: Maybe<Scalars['Float']['output']>;
  number_value?: Maybe<Scalars['Float']['output']>;
  version?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Application_Configurations_Var_Samp_Fields = {
  __typename?: 'application_configurations_var_samp_fields';
  max_value?: Maybe<Scalars['Float']['output']>;
  min_value?: Maybe<Scalars['Float']['output']>;
  number_value?: Maybe<Scalars['Float']['output']>;
  version?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Application_Configurations_Variance_Fields = {
  __typename?: 'application_configurations_variance_fields';
  max_value?: Maybe<Scalars['Float']['output']>;
  min_value?: Maybe<Scalars['Float']['output']>;
  number_value?: Maybe<Scalars['Float']['output']>;
  version?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
export type Bigint_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['bigint']['input']>;
  _gt?: InputMaybe<Scalars['bigint']['input']>;
  _gte?: InputMaybe<Scalars['bigint']['input']>;
  _in?: InputMaybe<Array<Scalars['bigint']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['bigint']['input']>;
  _lte?: InputMaybe<Scalars['bigint']['input']>;
  _neq?: InputMaybe<Scalars['bigint']['input']>;
  _nin?: InputMaybe<Array<Scalars['bigint']['input']>>;
};

/** Boolean expression to compare columns of type "bpchar". All fields are combined with logical 'AND'. */
export type Bpchar_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['bpchar']['input']>;
  _gt?: InputMaybe<Scalars['bpchar']['input']>;
  _gte?: InputMaybe<Scalars['bpchar']['input']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['bpchar']['input']>;
  _in?: InputMaybe<Array<Scalars['bpchar']['input']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['bpchar']['input']>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['bpchar']['input']>;
  _lt?: InputMaybe<Scalars['bpchar']['input']>;
  _lte?: InputMaybe<Scalars['bpchar']['input']>;
  _neq?: InputMaybe<Scalars['bpchar']['input']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['bpchar']['input']>;
  _nin?: InputMaybe<Array<Scalars['bpchar']['input']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['bpchar']['input']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['bpchar']['input']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['bpchar']['input']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['bpchar']['input']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['bpchar']['input']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['bpchar']['input']>;
};

/** columns and relationships of "brands" */
export type Brands = {
  __typename?: 'brands';
  created_at: Scalars['timestamptz']['output'];
  description: Scalars['String']['output'];
  id: Scalars['uuid']['output'];
  /** An array relationship */
  items: Array<Items>;
  /** An aggregate relationship */
  items_aggregate: Items_Aggregate;
  name: Scalars['String']['output'];
  updated_at: Scalars['timestamptz']['output'];
};


/** columns and relationships of "brands" */
export type BrandsItemsArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};


/** columns and relationships of "brands" */
export type BrandsItems_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};

/** aggregated selection of "brands" */
export type Brands_Aggregate = {
  __typename?: 'brands_aggregate';
  aggregate?: Maybe<Brands_Aggregate_Fields>;
  nodes: Array<Brands>;
};

/** aggregate fields of "brands" */
export type Brands_Aggregate_Fields = {
  __typename?: 'brands_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Brands_Max_Fields>;
  min?: Maybe<Brands_Min_Fields>;
};


/** aggregate fields of "brands" */
export type Brands_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Brands_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "brands". All fields are combined with a logical 'AND'. */
export type Brands_Bool_Exp = {
  _and?: InputMaybe<Array<Brands_Bool_Exp>>;
  _not?: InputMaybe<Brands_Bool_Exp>;
  _or?: InputMaybe<Array<Brands_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  items?: InputMaybe<Items_Bool_Exp>;
  items_aggregate?: InputMaybe<Items_Aggregate_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "brands" */
export enum Brands_Constraint {
  /** unique or primary key constraint on columns "name" */
  BrandsNameKey = 'brands_name_key',
  /** unique or primary key constraint on columns "id" */
  BrandsPkey = 'brands_pkey'
}

/** input type for inserting data into table "brands" */
export type Brands_Insert_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  items?: InputMaybe<Items_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Brands_Max_Fields = {
  __typename?: 'brands_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregate min on columns */
export type Brands_Min_Fields = {
  __typename?: 'brands_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** response of any mutation on the table "brands" */
export type Brands_Mutation_Response = {
  __typename?: 'brands_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Brands>;
};

/** input type for inserting object relation for remote table "brands" */
export type Brands_Obj_Rel_Insert_Input = {
  data: Brands_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Brands_On_Conflict>;
};

/** on_conflict condition type for table "brands" */
export type Brands_On_Conflict = {
  constraint: Brands_Constraint;
  update_columns?: Array<Brands_Update_Column>;
  where?: InputMaybe<Brands_Bool_Exp>;
};

/** Ordering options when selecting data from "brands". */
export type Brands_Order_By = {
  created_at?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  items_aggregate?: InputMaybe<Items_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: brands */
export type Brands_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "brands" */
export enum Brands_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "brands" */
export type Brands_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** Streaming cursor of the table "brands" */
export type Brands_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Brands_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Brands_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** update columns of table "brands" */
export enum Brands_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Brands_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Brands_Set_Input>;
  /** filter the rows which have to be updated */
  where: Brands_Bool_Exp;
};

/** columns and relationships of "business_addresses" */
export type Business_Addresses = {
  __typename?: 'business_addresses';
  /** An object relationship */
  address: Addresses;
  address_id: Scalars['uuid']['output'];
  /** An object relationship */
  business: Businesses;
  business_id: Scalars['uuid']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id: Scalars['uuid']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregated selection of "business_addresses" */
export type Business_Addresses_Aggregate = {
  __typename?: 'business_addresses_aggregate';
  aggregate?: Maybe<Business_Addresses_Aggregate_Fields>;
  nodes: Array<Business_Addresses>;
};

export type Business_Addresses_Aggregate_Bool_Exp = {
  count?: InputMaybe<Business_Addresses_Aggregate_Bool_Exp_Count>;
};

export type Business_Addresses_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Business_Addresses_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "business_addresses" */
export type Business_Addresses_Aggregate_Fields = {
  __typename?: 'business_addresses_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Business_Addresses_Max_Fields>;
  min?: Maybe<Business_Addresses_Min_Fields>;
};


/** aggregate fields of "business_addresses" */
export type Business_Addresses_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "business_addresses" */
export type Business_Addresses_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Business_Addresses_Max_Order_By>;
  min?: InputMaybe<Business_Addresses_Min_Order_By>;
};

/** input type for inserting array relation for remote table "business_addresses" */
export type Business_Addresses_Arr_Rel_Insert_Input = {
  data: Array<Business_Addresses_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Business_Addresses_On_Conflict>;
};

/** Boolean expression to filter rows from the table "business_addresses". All fields are combined with a logical 'AND'. */
export type Business_Addresses_Bool_Exp = {
  _and?: InputMaybe<Array<Business_Addresses_Bool_Exp>>;
  _not?: InputMaybe<Business_Addresses_Bool_Exp>;
  _or?: InputMaybe<Array<Business_Addresses_Bool_Exp>>;
  address?: InputMaybe<Addresses_Bool_Exp>;
  address_id?: InputMaybe<Uuid_Comparison_Exp>;
  business?: InputMaybe<Businesses_Bool_Exp>;
  business_id?: InputMaybe<Uuid_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "business_addresses" */
export enum Business_Addresses_Constraint {
  /** unique or primary key constraint on columns "id" */
  BusinessAddressesPkey = 'business_addresses_pkey',
  /** unique or primary key constraint on columns "address_id" */
  UniqueBusinessAddressAddressId = 'unique_business_address_address_id'
}

/** input type for inserting data into table "business_addresses" */
export type Business_Addresses_Insert_Input = {
  address?: InputMaybe<Addresses_Obj_Rel_Insert_Input>;
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  business?: InputMaybe<Businesses_Obj_Rel_Insert_Input>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Business_Addresses_Max_Fields = {
  __typename?: 'business_addresses_max_fields';
  address_id?: Maybe<Scalars['uuid']['output']>;
  business_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "business_addresses" */
export type Business_Addresses_Max_Order_By = {
  address_id?: InputMaybe<Order_By>;
  business_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Business_Addresses_Min_Fields = {
  __typename?: 'business_addresses_min_fields';
  address_id?: Maybe<Scalars['uuid']['output']>;
  business_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "business_addresses" */
export type Business_Addresses_Min_Order_By = {
  address_id?: InputMaybe<Order_By>;
  business_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "business_addresses" */
export type Business_Addresses_Mutation_Response = {
  __typename?: 'business_addresses_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Business_Addresses>;
};

/** on_conflict condition type for table "business_addresses" */
export type Business_Addresses_On_Conflict = {
  constraint: Business_Addresses_Constraint;
  update_columns?: Array<Business_Addresses_Update_Column>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};

/** Ordering options when selecting data from "business_addresses". */
export type Business_Addresses_Order_By = {
  address?: InputMaybe<Addresses_Order_By>;
  address_id?: InputMaybe<Order_By>;
  business?: InputMaybe<Businesses_Order_By>;
  business_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: business_addresses */
export type Business_Addresses_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "business_addresses" */
export enum Business_Addresses_Select_Column {
  /** column name */
  AddressId = 'address_id',
  /** column name */
  BusinessId = 'business_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "business_addresses" */
export type Business_Addresses_Set_Input = {
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** Streaming cursor of the table "business_addresses" */
export type Business_Addresses_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Business_Addresses_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Business_Addresses_Stream_Cursor_Value_Input = {
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** update columns of table "business_addresses" */
export enum Business_Addresses_Update_Column {
  /** column name */
  AddressId = 'address_id',
  /** column name */
  BusinessId = 'business_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Business_Addresses_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Business_Addresses_Set_Input>;
  /** filter the rows which have to be updated */
  where: Business_Addresses_Bool_Exp;
};

/** Tracks item inventory at specific business locations */
export type Business_Inventory = {
  __typename?: 'business_inventory';
  /** An object relationship */
  business_location: Business_Locations;
  business_location_id: Scalars['uuid']['output'];
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  created_at: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  is_active?: Maybe<Scalars['Boolean']['output']>;
  /** An object relationship */
  item: Items;
  item_id: Scalars['uuid']['output'];
  last_restocked_at?: Maybe<Scalars['timestamptz']['output']>;
  /** An array relationship */
  order_items: Array<Order_Items>;
  /** An aggregate relationship */
  order_items_aggregate: Order_Items_Aggregate;
  /** Total quantity at this location */
  quantity: Scalars['Int']['output'];
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Int']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Int']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity: Scalars['Int']['output'];
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['numeric']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['numeric']['output']>;
  updated_at: Scalars['timestamptz']['output'];
};


/** Tracks item inventory at specific business locations */
export type Business_InventoryOrder_ItemsArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


/** Tracks item inventory at specific business locations */
export type Business_InventoryOrder_Items_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};

/** aggregated selection of "business_inventory" */
export type Business_Inventory_Aggregate = {
  __typename?: 'business_inventory_aggregate';
  aggregate?: Maybe<Business_Inventory_Aggregate_Fields>;
  nodes: Array<Business_Inventory>;
};

export type Business_Inventory_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Business_Inventory_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Business_Inventory_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Business_Inventory_Aggregate_Bool_Exp_Count>;
};

export type Business_Inventory_Aggregate_Bool_Exp_Bool_And = {
  arguments: Business_Inventory_Select_Column_Business_Inventory_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Business_Inventory_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Business_Inventory_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Business_Inventory_Select_Column_Business_Inventory_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Business_Inventory_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Business_Inventory_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Business_Inventory_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "business_inventory" */
export type Business_Inventory_Aggregate_Fields = {
  __typename?: 'business_inventory_aggregate_fields';
  avg?: Maybe<Business_Inventory_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Business_Inventory_Max_Fields>;
  min?: Maybe<Business_Inventory_Min_Fields>;
  stddev?: Maybe<Business_Inventory_Stddev_Fields>;
  stddev_pop?: Maybe<Business_Inventory_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Business_Inventory_Stddev_Samp_Fields>;
  sum?: Maybe<Business_Inventory_Sum_Fields>;
  var_pop?: Maybe<Business_Inventory_Var_Pop_Fields>;
  var_samp?: Maybe<Business_Inventory_Var_Samp_Fields>;
  variance?: Maybe<Business_Inventory_Variance_Fields>;
};


/** aggregate fields of "business_inventory" */
export type Business_Inventory_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "business_inventory" */
export type Business_Inventory_Aggregate_Order_By = {
  avg?: InputMaybe<Business_Inventory_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Business_Inventory_Max_Order_By>;
  min?: InputMaybe<Business_Inventory_Min_Order_By>;
  stddev?: InputMaybe<Business_Inventory_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Business_Inventory_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Business_Inventory_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Business_Inventory_Sum_Order_By>;
  var_pop?: InputMaybe<Business_Inventory_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Business_Inventory_Var_Samp_Order_By>;
  variance?: InputMaybe<Business_Inventory_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "business_inventory" */
export type Business_Inventory_Arr_Rel_Insert_Input = {
  data: Array<Business_Inventory_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Business_Inventory_On_Conflict>;
};

/** aggregate avg on columns */
export type Business_Inventory_Avg_Fields = {
  __typename?: 'business_inventory_avg_fields';
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Float']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Float']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Float']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Float']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['Float']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "business_inventory" */
export type Business_Inventory_Avg_Order_By = {
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "business_inventory". All fields are combined with a logical 'AND'. */
export type Business_Inventory_Bool_Exp = {
  _and?: InputMaybe<Array<Business_Inventory_Bool_Exp>>;
  _not?: InputMaybe<Business_Inventory_Bool_Exp>;
  _or?: InputMaybe<Array<Business_Inventory_Bool_Exp>>;
  business_location?: InputMaybe<Business_Locations_Bool_Exp>;
  business_location_id?: InputMaybe<Uuid_Comparison_Exp>;
  computed_available_quantity?: InputMaybe<Int_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_active?: InputMaybe<Boolean_Comparison_Exp>;
  item?: InputMaybe<Items_Bool_Exp>;
  item_id?: InputMaybe<Uuid_Comparison_Exp>;
  last_restocked_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  order_items?: InputMaybe<Order_Items_Bool_Exp>;
  order_items_aggregate?: InputMaybe<Order_Items_Aggregate_Bool_Exp>;
  quantity?: InputMaybe<Int_Comparison_Exp>;
  reorder_point?: InputMaybe<Int_Comparison_Exp>;
  reorder_quantity?: InputMaybe<Int_Comparison_Exp>;
  reserved_quantity?: InputMaybe<Int_Comparison_Exp>;
  selling_price?: InputMaybe<Numeric_Comparison_Exp>;
  unit_cost?: InputMaybe<Numeric_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "business_inventory" */
export enum Business_Inventory_Constraint {
  /** unique or primary key constraint on columns "id" */
  BusinessInventoryPkey = 'business_inventory_pkey',
  /** unique or primary key constraint on columns "item_id", "business_location_id" */
  UniqueLocationItem = 'unique_location_item'
}

/** input type for incrementing numeric columns in table "business_inventory" */
export type Business_Inventory_Inc_Input = {
  /** Total quantity at this location */
  quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Scalars['Int']['input']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Scalars['numeric']['input']>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "business_inventory" */
export type Business_Inventory_Insert_Input = {
  business_location?: InputMaybe<Business_Locations_Obj_Rel_Insert_Input>;
  business_location_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  item?: InputMaybe<Items_Obj_Rel_Insert_Input>;
  item_id?: InputMaybe<Scalars['uuid']['input']>;
  last_restocked_at?: InputMaybe<Scalars['timestamptz']['input']>;
  order_items?: InputMaybe<Order_Items_Arr_Rel_Insert_Input>;
  /** Total quantity at this location */
  quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Scalars['Int']['input']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Scalars['numeric']['input']>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Business_Inventory_Max_Fields = {
  __typename?: 'business_inventory_max_fields';
  business_location_id?: Maybe<Scalars['uuid']['output']>;
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  item_id?: Maybe<Scalars['uuid']['output']>;
  last_restocked_at?: Maybe<Scalars['timestamptz']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Int']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Int']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Int']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Int']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['numeric']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['numeric']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "business_inventory" */
export type Business_Inventory_Max_Order_By = {
  business_location_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_id?: InputMaybe<Order_By>;
  last_restocked_at?: InputMaybe<Order_By>;
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Business_Inventory_Min_Fields = {
  __typename?: 'business_inventory_min_fields';
  business_location_id?: Maybe<Scalars['uuid']['output']>;
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  item_id?: Maybe<Scalars['uuid']['output']>;
  last_restocked_at?: Maybe<Scalars['timestamptz']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Int']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Int']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Int']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Int']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['numeric']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['numeric']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "business_inventory" */
export type Business_Inventory_Min_Order_By = {
  business_location_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_id?: InputMaybe<Order_By>;
  last_restocked_at?: InputMaybe<Order_By>;
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "business_inventory" */
export type Business_Inventory_Mutation_Response = {
  __typename?: 'business_inventory_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Business_Inventory>;
};

/** input type for inserting object relation for remote table "business_inventory" */
export type Business_Inventory_Obj_Rel_Insert_Input = {
  data: Business_Inventory_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Business_Inventory_On_Conflict>;
};

/** on_conflict condition type for table "business_inventory" */
export type Business_Inventory_On_Conflict = {
  constraint: Business_Inventory_Constraint;
  update_columns?: Array<Business_Inventory_Update_Column>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};

/** Ordering options when selecting data from "business_inventory". */
export type Business_Inventory_Order_By = {
  business_location?: InputMaybe<Business_Locations_Order_By>;
  business_location_id?: InputMaybe<Order_By>;
  computed_available_quantity?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_active?: InputMaybe<Order_By>;
  item?: InputMaybe<Items_Order_By>;
  item_id?: InputMaybe<Order_By>;
  last_restocked_at?: InputMaybe<Order_By>;
  order_items_aggregate?: InputMaybe<Order_Items_Aggregate_Order_By>;
  quantity?: InputMaybe<Order_By>;
  reorder_point?: InputMaybe<Order_By>;
  reorder_quantity?: InputMaybe<Order_By>;
  reserved_quantity?: InputMaybe<Order_By>;
  selling_price?: InputMaybe<Order_By>;
  unit_cost?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: business_inventory */
export type Business_Inventory_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "business_inventory" */
export enum Business_Inventory_Select_Column {
  /** column name */
  BusinessLocationId = 'business_location_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  ItemId = 'item_id',
  /** column name */
  LastRestockedAt = 'last_restocked_at',
  /** column name */
  Quantity = 'quantity',
  /** column name */
  ReorderPoint = 'reorder_point',
  /** column name */
  ReorderQuantity = 'reorder_quantity',
  /** column name */
  ReservedQuantity = 'reserved_quantity',
  /** column name */
  SellingPrice = 'selling_price',
  /** column name */
  UnitCost = 'unit_cost',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** select "business_inventory_aggregate_bool_exp_bool_and_arguments_columns" columns of table "business_inventory" */
export enum Business_Inventory_Select_Column_Business_Inventory_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsActive = 'is_active'
}

/** select "business_inventory_aggregate_bool_exp_bool_or_arguments_columns" columns of table "business_inventory" */
export enum Business_Inventory_Select_Column_Business_Inventory_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsActive = 'is_active'
}

/** input type for updating data in table "business_inventory" */
export type Business_Inventory_Set_Input = {
  business_location_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  item_id?: InputMaybe<Scalars['uuid']['input']>;
  last_restocked_at?: InputMaybe<Scalars['timestamptz']['input']>;
  /** Total quantity at this location */
  quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Scalars['Int']['input']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Scalars['numeric']['input']>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Business_Inventory_Stddev_Fields = {
  __typename?: 'business_inventory_stddev_fields';
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Float']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Float']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Float']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Float']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['Float']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "business_inventory" */
export type Business_Inventory_Stddev_Order_By = {
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Business_Inventory_Stddev_Pop_Fields = {
  __typename?: 'business_inventory_stddev_pop_fields';
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Float']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Float']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Float']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Float']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['Float']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "business_inventory" */
export type Business_Inventory_Stddev_Pop_Order_By = {
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Business_Inventory_Stddev_Samp_Fields = {
  __typename?: 'business_inventory_stddev_samp_fields';
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Float']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Float']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Float']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Float']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['Float']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "business_inventory" */
export type Business_Inventory_Stddev_Samp_Order_By = {
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "business_inventory" */
export type Business_Inventory_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Business_Inventory_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Business_Inventory_Stream_Cursor_Value_Input = {
  business_location_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  item_id?: InputMaybe<Scalars['uuid']['input']>;
  last_restocked_at?: InputMaybe<Scalars['timestamptz']['input']>;
  /** Total quantity at this location */
  quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Scalars['Int']['input']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Scalars['Int']['input']>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Scalars['numeric']['input']>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Business_Inventory_Sum_Fields = {
  __typename?: 'business_inventory_sum_fields';
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Int']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Int']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Int']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Int']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['numeric']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "business_inventory" */
export type Business_Inventory_Sum_Order_By = {
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
};

/** update columns of table "business_inventory" */
export enum Business_Inventory_Update_Column {
  /** column name */
  BusinessLocationId = 'business_location_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  ItemId = 'item_id',
  /** column name */
  LastRestockedAt = 'last_restocked_at',
  /** column name */
  Quantity = 'quantity',
  /** column name */
  ReorderPoint = 'reorder_point',
  /** column name */
  ReorderQuantity = 'reorder_quantity',
  /** column name */
  ReservedQuantity = 'reserved_quantity',
  /** column name */
  SellingPrice = 'selling_price',
  /** column name */
  UnitCost = 'unit_cost',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Business_Inventory_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Business_Inventory_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Business_Inventory_Set_Input>;
  /** filter the rows which have to be updated */
  where: Business_Inventory_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Business_Inventory_Var_Pop_Fields = {
  __typename?: 'business_inventory_var_pop_fields';
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Float']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Float']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Float']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Float']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['Float']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "business_inventory" */
export type Business_Inventory_Var_Pop_Order_By = {
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Business_Inventory_Var_Samp_Fields = {
  __typename?: 'business_inventory_var_samp_fields';
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Float']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Float']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Float']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Float']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['Float']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "business_inventory" */
export type Business_Inventory_Var_Samp_Order_By = {
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Business_Inventory_Variance_Fields = {
  __typename?: 'business_inventory_variance_fields';
  /** Computed field that returns quantity minus reserved_quantity */
  computed_available_quantity?: Maybe<Scalars['Int']['output']>;
  /** Total quantity at this location */
  quantity?: Maybe<Scalars['Float']['output']>;
  /** Inventory level at which to reorder */
  reorder_point?: Maybe<Scalars['Float']['output']>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: Maybe<Scalars['Float']['output']>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: Maybe<Scalars['Float']['output']>;
  /** Selling price at this location (can override item price) */
  selling_price?: Maybe<Scalars['Float']['output']>;
  /** Cost per unit for this location */
  unit_cost?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "business_inventory" */
export type Business_Inventory_Variance_Order_By = {
  /** Total quantity at this location */
  quantity?: InputMaybe<Order_By>;
  /** Inventory level at which to reorder */
  reorder_point?: InputMaybe<Order_By>;
  /** How much to reorder when below reorder point */
  reorder_quantity?: InputMaybe<Order_By>;
  /** Quantity reserved for pending orders */
  reserved_quantity?: InputMaybe<Order_By>;
  /** Selling price at this location (can override item price) */
  selling_price?: InputMaybe<Order_By>;
  /** Cost per unit for this location */
  unit_cost?: InputMaybe<Order_By>;
};

/** Stores multiple locations for each business */
export type Business_Locations = {
  __typename?: 'business_locations';
  /** An object relationship */
  address: Addresses;
  address_id: Scalars['uuid']['output'];
  /** An object relationship */
  business: Businesses;
  business_id: Scalars['uuid']['output'];
  /** An array relationship */
  business_inventory: Array<Business_Inventory>;
  /** An aggregate relationship */
  business_inventory_aggregate: Business_Inventory_Aggregate;
  created_at: Scalars['timestamptz']['output'];
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  is_active?: Maybe<Scalars['Boolean']['output']>;
  /** Whether this is the primary location for the business */
  is_primary?: Maybe<Scalars['Boolean']['output']>;
  /** Type of location (store, warehouse, office, pickup_point, etc.) */
  location_type?: Maybe<Scalars['location_type_enum']['output']>;
  /** Name of the location (e.g., Downtown Store, Warehouse) */
  name: Scalars['String']['output'];
  /** JSON object storing operating hours for each day */
  operating_hours?: Maybe<Scalars['jsonb']['output']>;
  /** An array relationship */
  orders: Array<Orders>;
  /** An aggregate relationship */
  orders_aggregate: Orders_Aggregate;
  phone?: Maybe<Scalars['String']['output']>;
  updated_at: Scalars['timestamptz']['output'];
};


/** Stores multiple locations for each business */
export type Business_LocationsBusiness_InventoryArgs = {
  distinct_on?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Inventory_Order_By>>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};


/** Stores multiple locations for each business */
export type Business_LocationsBusiness_Inventory_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Inventory_Order_By>>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};


/** Stores multiple locations for each business */
export type Business_LocationsOperating_HoursArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};


/** Stores multiple locations for each business */
export type Business_LocationsOrdersArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


/** Stores multiple locations for each business */
export type Business_LocationsOrders_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};

/** aggregated selection of "business_locations" */
export type Business_Locations_Aggregate = {
  __typename?: 'business_locations_aggregate';
  aggregate?: Maybe<Business_Locations_Aggregate_Fields>;
  nodes: Array<Business_Locations>;
};

export type Business_Locations_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Business_Locations_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Business_Locations_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Business_Locations_Aggregate_Bool_Exp_Count>;
};

export type Business_Locations_Aggregate_Bool_Exp_Bool_And = {
  arguments: Business_Locations_Select_Column_Business_Locations_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Business_Locations_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Business_Locations_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Business_Locations_Select_Column_Business_Locations_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Business_Locations_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Business_Locations_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Business_Locations_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Business_Locations_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "business_locations" */
export type Business_Locations_Aggregate_Fields = {
  __typename?: 'business_locations_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Business_Locations_Max_Fields>;
  min?: Maybe<Business_Locations_Min_Fields>;
};


/** aggregate fields of "business_locations" */
export type Business_Locations_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Business_Locations_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "business_locations" */
export type Business_Locations_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Business_Locations_Max_Order_By>;
  min?: InputMaybe<Business_Locations_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Business_Locations_Append_Input = {
  /** JSON object storing operating hours for each day */
  operating_hours?: InputMaybe<Scalars['jsonb']['input']>;
};

/** input type for inserting array relation for remote table "business_locations" */
export type Business_Locations_Arr_Rel_Insert_Input = {
  data: Array<Business_Locations_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Business_Locations_On_Conflict>;
};

/** Boolean expression to filter rows from the table "business_locations". All fields are combined with a logical 'AND'. */
export type Business_Locations_Bool_Exp = {
  _and?: InputMaybe<Array<Business_Locations_Bool_Exp>>;
  _not?: InputMaybe<Business_Locations_Bool_Exp>;
  _or?: InputMaybe<Array<Business_Locations_Bool_Exp>>;
  address?: InputMaybe<Addresses_Bool_Exp>;
  address_id?: InputMaybe<Uuid_Comparison_Exp>;
  business?: InputMaybe<Businesses_Bool_Exp>;
  business_id?: InputMaybe<Uuid_Comparison_Exp>;
  business_inventory?: InputMaybe<Business_Inventory_Bool_Exp>;
  business_inventory_aggregate?: InputMaybe<Business_Inventory_Aggregate_Bool_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  email?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_active?: InputMaybe<Boolean_Comparison_Exp>;
  is_primary?: InputMaybe<Boolean_Comparison_Exp>;
  location_type?: InputMaybe<Location_Type_Enum_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  operating_hours?: InputMaybe<Jsonb_Comparison_Exp>;
  orders?: InputMaybe<Orders_Bool_Exp>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Bool_Exp>;
  phone?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "business_locations" */
export enum Business_Locations_Constraint {
  /** unique or primary key constraint on columns "address_id" */
  BusinessLocationsAddressIdUniqueIdx = 'business_locations_address_id_unique_idx',
  /** unique or primary key constraint on columns "id" */
  BusinessLocationsPkey = 'business_locations_pkey'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Business_Locations_Delete_At_Path_Input = {
  /** JSON object storing operating hours for each day */
  operating_hours?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Business_Locations_Delete_Elem_Input = {
  /** JSON object storing operating hours for each day */
  operating_hours?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Business_Locations_Delete_Key_Input = {
  /** JSON object storing operating hours for each day */
  operating_hours?: InputMaybe<Scalars['String']['input']>;
};

/** input type for inserting data into table "business_locations" */
export type Business_Locations_Insert_Input = {
  address?: InputMaybe<Addresses_Obj_Rel_Insert_Input>;
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  business?: InputMaybe<Businesses_Obj_Rel_Insert_Input>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  business_inventory?: InputMaybe<Business_Inventory_Arr_Rel_Insert_Input>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether this is the primary location for the business */
  is_primary?: InputMaybe<Scalars['Boolean']['input']>;
  /** Type of location (store, warehouse, office, pickup_point, etc.) */
  location_type?: InputMaybe<Scalars['location_type_enum']['input']>;
  /** Name of the location (e.g., Downtown Store, Warehouse) */
  name?: InputMaybe<Scalars['String']['input']>;
  /** JSON object storing operating hours for each day */
  operating_hours?: InputMaybe<Scalars['jsonb']['input']>;
  orders?: InputMaybe<Orders_Arr_Rel_Insert_Input>;
  phone?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Business_Locations_Max_Fields = {
  __typename?: 'business_locations_max_fields';
  address_id?: Maybe<Scalars['uuid']['output']>;
  business_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Type of location (store, warehouse, office, pickup_point, etc.) */
  location_type?: Maybe<Scalars['location_type_enum']['output']>;
  /** Name of the location (e.g., Downtown Store, Warehouse) */
  name?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "business_locations" */
export type Business_Locations_Max_Order_By = {
  address_id?: InputMaybe<Order_By>;
  business_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Type of location (store, warehouse, office, pickup_point, etc.) */
  location_type?: InputMaybe<Order_By>;
  /** Name of the location (e.g., Downtown Store, Warehouse) */
  name?: InputMaybe<Order_By>;
  phone?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Business_Locations_Min_Fields = {
  __typename?: 'business_locations_min_fields';
  address_id?: Maybe<Scalars['uuid']['output']>;
  business_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Type of location (store, warehouse, office, pickup_point, etc.) */
  location_type?: Maybe<Scalars['location_type_enum']['output']>;
  /** Name of the location (e.g., Downtown Store, Warehouse) */
  name?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "business_locations" */
export type Business_Locations_Min_Order_By = {
  address_id?: InputMaybe<Order_By>;
  business_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Type of location (store, warehouse, office, pickup_point, etc.) */
  location_type?: InputMaybe<Order_By>;
  /** Name of the location (e.g., Downtown Store, Warehouse) */
  name?: InputMaybe<Order_By>;
  phone?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "business_locations" */
export type Business_Locations_Mutation_Response = {
  __typename?: 'business_locations_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Business_Locations>;
};

/** input type for inserting object relation for remote table "business_locations" */
export type Business_Locations_Obj_Rel_Insert_Input = {
  data: Business_Locations_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Business_Locations_On_Conflict>;
};

/** on_conflict condition type for table "business_locations" */
export type Business_Locations_On_Conflict = {
  constraint: Business_Locations_Constraint;
  update_columns?: Array<Business_Locations_Update_Column>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};

/** Ordering options when selecting data from "business_locations". */
export type Business_Locations_Order_By = {
  address?: InputMaybe<Addresses_Order_By>;
  address_id?: InputMaybe<Order_By>;
  business?: InputMaybe<Businesses_Order_By>;
  business_id?: InputMaybe<Order_By>;
  business_inventory_aggregate?: InputMaybe<Business_Inventory_Aggregate_Order_By>;
  created_at?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_active?: InputMaybe<Order_By>;
  is_primary?: InputMaybe<Order_By>;
  location_type?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  operating_hours?: InputMaybe<Order_By>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Order_By>;
  phone?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: business_locations */
export type Business_Locations_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Business_Locations_Prepend_Input = {
  /** JSON object storing operating hours for each day */
  operating_hours?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "business_locations" */
export enum Business_Locations_Select_Column {
  /** column name */
  AddressId = 'address_id',
  /** column name */
  BusinessId = 'business_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Email = 'email',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  IsPrimary = 'is_primary',
  /** column name */
  LocationType = 'location_type',
  /** column name */
  Name = 'name',
  /** column name */
  OperatingHours = 'operating_hours',
  /** column name */
  Phone = 'phone',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** select "business_locations_aggregate_bool_exp_bool_and_arguments_columns" columns of table "business_locations" */
export enum Business_Locations_Select_Column_Business_Locations_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsActive = 'is_active',
  /** column name */
  IsPrimary = 'is_primary'
}

/** select "business_locations_aggregate_bool_exp_bool_or_arguments_columns" columns of table "business_locations" */
export enum Business_Locations_Select_Column_Business_Locations_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsActive = 'is_active',
  /** column name */
  IsPrimary = 'is_primary'
}

/** input type for updating data in table "business_locations" */
export type Business_Locations_Set_Input = {
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether this is the primary location for the business */
  is_primary?: InputMaybe<Scalars['Boolean']['input']>;
  /** Type of location (store, warehouse, office, pickup_point, etc.) */
  location_type?: InputMaybe<Scalars['location_type_enum']['input']>;
  /** Name of the location (e.g., Downtown Store, Warehouse) */
  name?: InputMaybe<Scalars['String']['input']>;
  /** JSON object storing operating hours for each day */
  operating_hours?: InputMaybe<Scalars['jsonb']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** Streaming cursor of the table "business_locations" */
export type Business_Locations_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Business_Locations_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Business_Locations_Stream_Cursor_Value_Input = {
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether this is the primary location for the business */
  is_primary?: InputMaybe<Scalars['Boolean']['input']>;
  /** Type of location (store, warehouse, office, pickup_point, etc.) */
  location_type?: InputMaybe<Scalars['location_type_enum']['input']>;
  /** Name of the location (e.g., Downtown Store, Warehouse) */
  name?: InputMaybe<Scalars['String']['input']>;
  /** JSON object storing operating hours for each day */
  operating_hours?: InputMaybe<Scalars['jsonb']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** update columns of table "business_locations" */
export enum Business_Locations_Update_Column {
  /** column name */
  AddressId = 'address_id',
  /** column name */
  BusinessId = 'business_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Email = 'email',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  IsPrimary = 'is_primary',
  /** column name */
  LocationType = 'location_type',
  /** column name */
  Name = 'name',
  /** column name */
  OperatingHours = 'operating_hours',
  /** column name */
  Phone = 'phone',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Business_Locations_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Business_Locations_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Business_Locations_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Business_Locations_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Business_Locations_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Business_Locations_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Business_Locations_Set_Input>;
  /** filter the rows which have to be updated */
  where: Business_Locations_Bool_Exp;
};

/** columns and relationships of "businesses" */
export type Businesses = {
  __typename?: 'businesses';
  /** An array relationship */
  business_addresses: Array<Business_Addresses>;
  /** An aggregate relationship */
  business_addresses_aggregate: Business_Addresses_Aggregate;
  /** An array relationship */
  business_locations: Array<Business_Locations>;
  /** An aggregate relationship */
  business_locations_aggregate: Business_Locations_Aggregate;
  created_at: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  /** Indicates if the business has admin privileges */
  is_admin?: Maybe<Scalars['Boolean']['output']>;
  /** Indicates if the business account has been verified */
  is_verified?: Maybe<Scalars['Boolean']['output']>;
  /** An array relationship */
  items: Array<Items>;
  /** An aggregate relationship */
  items_aggregate: Items_Aggregate;
  name: Scalars['String']['output'];
  /** An array relationship */
  orders: Array<Orders>;
  /** An aggregate relationship */
  orders_aggregate: Orders_Aggregate;
  updated_at: Scalars['timestamptz']['output'];
  /** An object relationship */
  user: Users;
  user_id: Scalars['uuid']['output'];
};


/** columns and relationships of "businesses" */
export type BusinessesBusiness_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Addresses_Order_By>>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};


/** columns and relationships of "businesses" */
export type BusinessesBusiness_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Addresses_Order_By>>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};


/** columns and relationships of "businesses" */
export type BusinessesBusiness_LocationsArgs = {
  distinct_on?: InputMaybe<Array<Business_Locations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Locations_Order_By>>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};


/** columns and relationships of "businesses" */
export type BusinessesBusiness_Locations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Locations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Locations_Order_By>>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};


/** columns and relationships of "businesses" */
export type BusinessesItemsArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};


/** columns and relationships of "businesses" */
export type BusinessesItems_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};


/** columns and relationships of "businesses" */
export type BusinessesOrdersArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


/** columns and relationships of "businesses" */
export type BusinessesOrders_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};

/** aggregated selection of "businesses" */
export type Businesses_Aggregate = {
  __typename?: 'businesses_aggregate';
  aggregate?: Maybe<Businesses_Aggregate_Fields>;
  nodes: Array<Businesses>;
};

/** aggregate fields of "businesses" */
export type Businesses_Aggregate_Fields = {
  __typename?: 'businesses_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Businesses_Max_Fields>;
  min?: Maybe<Businesses_Min_Fields>;
};


/** aggregate fields of "businesses" */
export type Businesses_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Businesses_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "businesses". All fields are combined with a logical 'AND'. */
export type Businesses_Bool_Exp = {
  _and?: InputMaybe<Array<Businesses_Bool_Exp>>;
  _not?: InputMaybe<Businesses_Bool_Exp>;
  _or?: InputMaybe<Array<Businesses_Bool_Exp>>;
  business_addresses?: InputMaybe<Business_Addresses_Bool_Exp>;
  business_addresses_aggregate?: InputMaybe<Business_Addresses_Aggregate_Bool_Exp>;
  business_locations?: InputMaybe<Business_Locations_Bool_Exp>;
  business_locations_aggregate?: InputMaybe<Business_Locations_Aggregate_Bool_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_admin?: InputMaybe<Boolean_Comparison_Exp>;
  is_verified?: InputMaybe<Boolean_Comparison_Exp>;
  items?: InputMaybe<Items_Bool_Exp>;
  items_aggregate?: InputMaybe<Items_Aggregate_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  orders?: InputMaybe<Orders_Bool_Exp>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Bool_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "businesses" */
export enum Businesses_Constraint {
  /** unique or primary key constraint on columns "id" */
  BusinessesPkey = 'businesses_pkey',
  /** unique or primary key constraint on columns "user_id" */
  BusinessesUserIdKey = 'businesses_user_id_key'
}

/** input type for inserting data into table "businesses" */
export type Businesses_Insert_Input = {
  business_addresses?: InputMaybe<Business_Addresses_Arr_Rel_Insert_Input>;
  business_locations?: InputMaybe<Business_Locations_Arr_Rel_Insert_Input>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Indicates if the business has admin privileges */
  is_admin?: InputMaybe<Scalars['Boolean']['input']>;
  /** Indicates if the business account has been verified */
  is_verified?: InputMaybe<Scalars['Boolean']['input']>;
  items?: InputMaybe<Items_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
  orders?: InputMaybe<Orders_Arr_Rel_Insert_Input>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type Businesses_Max_Fields = {
  __typename?: 'businesses_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type Businesses_Min_Fields = {
  __typename?: 'businesses_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "businesses" */
export type Businesses_Mutation_Response = {
  __typename?: 'businesses_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Businesses>;
};

/** input type for inserting object relation for remote table "businesses" */
export type Businesses_Obj_Rel_Insert_Input = {
  data: Businesses_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Businesses_On_Conflict>;
};

/** on_conflict condition type for table "businesses" */
export type Businesses_On_Conflict = {
  constraint: Businesses_Constraint;
  update_columns?: Array<Businesses_Update_Column>;
  where?: InputMaybe<Businesses_Bool_Exp>;
};

/** Ordering options when selecting data from "businesses". */
export type Businesses_Order_By = {
  business_addresses_aggregate?: InputMaybe<Business_Addresses_Aggregate_Order_By>;
  business_locations_aggregate?: InputMaybe<Business_Locations_Aggregate_Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_admin?: InputMaybe<Order_By>;
  is_verified?: InputMaybe<Order_By>;
  items_aggregate?: InputMaybe<Items_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: businesses */
export type Businesses_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "businesses" */
export enum Businesses_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsAdmin = 'is_admin',
  /** column name */
  IsVerified = 'is_verified',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

/** input type for updating data in table "businesses" */
export type Businesses_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Indicates if the business has admin privileges */
  is_admin?: InputMaybe<Scalars['Boolean']['input']>;
  /** Indicates if the business account has been verified */
  is_verified?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** Streaming cursor of the table "businesses" */
export type Businesses_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Businesses_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Businesses_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Indicates if the business has admin privileges */
  is_admin?: InputMaybe<Scalars['Boolean']['input']>;
  /** Indicates if the business account has been verified */
  is_verified?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "businesses" */
export enum Businesses_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsAdmin = 'is_admin',
  /** column name */
  IsVerified = 'is_verified',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

export type Businesses_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Businesses_Set_Input>;
  /** filter the rows which have to be updated */
  where: Businesses_Bool_Exp;
};

/** columns and relationships of "client_addresses" */
export type Client_Addresses = {
  __typename?: 'client_addresses';
  /** An object relationship */
  address: Addresses;
  address_id: Scalars['uuid']['output'];
  /** An object relationship */
  client: Clients;
  client_id: Scalars['uuid']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id: Scalars['uuid']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregated selection of "client_addresses" */
export type Client_Addresses_Aggregate = {
  __typename?: 'client_addresses_aggregate';
  aggregate?: Maybe<Client_Addresses_Aggregate_Fields>;
  nodes: Array<Client_Addresses>;
};

export type Client_Addresses_Aggregate_Bool_Exp = {
  count?: InputMaybe<Client_Addresses_Aggregate_Bool_Exp_Count>;
};

export type Client_Addresses_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Client_Addresses_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "client_addresses" */
export type Client_Addresses_Aggregate_Fields = {
  __typename?: 'client_addresses_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Client_Addresses_Max_Fields>;
  min?: Maybe<Client_Addresses_Min_Fields>;
};


/** aggregate fields of "client_addresses" */
export type Client_Addresses_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "client_addresses" */
export type Client_Addresses_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Client_Addresses_Max_Order_By>;
  min?: InputMaybe<Client_Addresses_Min_Order_By>;
};

/** input type for inserting array relation for remote table "client_addresses" */
export type Client_Addresses_Arr_Rel_Insert_Input = {
  data: Array<Client_Addresses_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Client_Addresses_On_Conflict>;
};

/** Boolean expression to filter rows from the table "client_addresses". All fields are combined with a logical 'AND'. */
export type Client_Addresses_Bool_Exp = {
  _and?: InputMaybe<Array<Client_Addresses_Bool_Exp>>;
  _not?: InputMaybe<Client_Addresses_Bool_Exp>;
  _or?: InputMaybe<Array<Client_Addresses_Bool_Exp>>;
  address?: InputMaybe<Addresses_Bool_Exp>;
  address_id?: InputMaybe<Uuid_Comparison_Exp>;
  client?: InputMaybe<Clients_Bool_Exp>;
  client_id?: InputMaybe<Uuid_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "client_addresses" */
export enum Client_Addresses_Constraint {
  /** unique or primary key constraint on columns "id" */
  ClientAddressesPkey = 'client_addresses_pkey',
  /** unique or primary key constraint on columns "address_id" */
  UniqueClientAddressAddressId = 'unique_client_address_address_id'
}

/** input type for inserting data into table "client_addresses" */
export type Client_Addresses_Insert_Input = {
  address?: InputMaybe<Addresses_Obj_Rel_Insert_Input>;
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  client?: InputMaybe<Clients_Obj_Rel_Insert_Input>;
  client_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Client_Addresses_Max_Fields = {
  __typename?: 'client_addresses_max_fields';
  address_id?: Maybe<Scalars['uuid']['output']>;
  client_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "client_addresses" */
export type Client_Addresses_Max_Order_By = {
  address_id?: InputMaybe<Order_By>;
  client_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Client_Addresses_Min_Fields = {
  __typename?: 'client_addresses_min_fields';
  address_id?: Maybe<Scalars['uuid']['output']>;
  client_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "client_addresses" */
export type Client_Addresses_Min_Order_By = {
  address_id?: InputMaybe<Order_By>;
  client_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "client_addresses" */
export type Client_Addresses_Mutation_Response = {
  __typename?: 'client_addresses_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Client_Addresses>;
};

/** on_conflict condition type for table "client_addresses" */
export type Client_Addresses_On_Conflict = {
  constraint: Client_Addresses_Constraint;
  update_columns?: Array<Client_Addresses_Update_Column>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};

/** Ordering options when selecting data from "client_addresses". */
export type Client_Addresses_Order_By = {
  address?: InputMaybe<Addresses_Order_By>;
  address_id?: InputMaybe<Order_By>;
  client?: InputMaybe<Clients_Order_By>;
  client_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: client_addresses */
export type Client_Addresses_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "client_addresses" */
export enum Client_Addresses_Select_Column {
  /** column name */
  AddressId = 'address_id',
  /** column name */
  ClientId = 'client_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "client_addresses" */
export type Client_Addresses_Set_Input = {
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  client_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** Streaming cursor of the table "client_addresses" */
export type Client_Addresses_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Client_Addresses_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Client_Addresses_Stream_Cursor_Value_Input = {
  address_id?: InputMaybe<Scalars['uuid']['input']>;
  client_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** update columns of table "client_addresses" */
export enum Client_Addresses_Update_Column {
  /** column name */
  AddressId = 'address_id',
  /** column name */
  ClientId = 'client_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Client_Addresses_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Client_Addresses_Set_Input>;
  /** filter the rows which have to be updated */
  where: Client_Addresses_Bool_Exp;
};

/** columns and relationships of "clients" */
export type Clients = {
  __typename?: 'clients';
  /** An array relationship */
  client_addresses: Array<Client_Addresses>;
  /** An aggregate relationship */
  client_addresses_aggregate: Client_Addresses_Aggregate;
  created_at: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  /** An array relationship */
  order_holds: Array<Order_Holds>;
  /** An aggregate relationship */
  order_holds_aggregate: Order_Holds_Aggregate;
  /** An array relationship */
  orders: Array<Orders>;
  /** An aggregate relationship */
  orders_aggregate: Orders_Aggregate;
  /** An array relationship */
  ratings_received: Array<Ratings>;
  /** An aggregate relationship */
  ratings_received_aggregate: Ratings_Aggregate;
  updated_at: Scalars['timestamptz']['output'];
  /** An object relationship */
  user: Users;
  user_id: Scalars['uuid']['output'];
};


/** columns and relationships of "clients" */
export type ClientsClient_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Client_Addresses_Order_By>>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};


/** columns and relationships of "clients" */
export type ClientsClient_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Client_Addresses_Order_By>>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};


/** columns and relationships of "clients" */
export type ClientsOrder_HoldsArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


/** columns and relationships of "clients" */
export type ClientsOrder_Holds_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


/** columns and relationships of "clients" */
export type ClientsOrdersArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


/** columns and relationships of "clients" */
export type ClientsOrders_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


/** columns and relationships of "clients" */
export type ClientsRatings_ReceivedArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


/** columns and relationships of "clients" */
export type ClientsRatings_Received_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};

/** aggregated selection of "clients" */
export type Clients_Aggregate = {
  __typename?: 'clients_aggregate';
  aggregate?: Maybe<Clients_Aggregate_Fields>;
  nodes: Array<Clients>;
};

/** aggregate fields of "clients" */
export type Clients_Aggregate_Fields = {
  __typename?: 'clients_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Clients_Max_Fields>;
  min?: Maybe<Clients_Min_Fields>;
};


/** aggregate fields of "clients" */
export type Clients_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Clients_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "clients". All fields are combined with a logical 'AND'. */
export type Clients_Bool_Exp = {
  _and?: InputMaybe<Array<Clients_Bool_Exp>>;
  _not?: InputMaybe<Clients_Bool_Exp>;
  _or?: InputMaybe<Array<Clients_Bool_Exp>>;
  client_addresses?: InputMaybe<Client_Addresses_Bool_Exp>;
  client_addresses_aggregate?: InputMaybe<Client_Addresses_Aggregate_Bool_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  order_holds?: InputMaybe<Order_Holds_Bool_Exp>;
  order_holds_aggregate?: InputMaybe<Order_Holds_Aggregate_Bool_Exp>;
  orders?: InputMaybe<Orders_Bool_Exp>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Bool_Exp>;
  ratings_received?: InputMaybe<Ratings_Bool_Exp>;
  ratings_received_aggregate?: InputMaybe<Ratings_Aggregate_Bool_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "clients" */
export enum Clients_Constraint {
  /** unique or primary key constraint on columns "id" */
  ClientsPkey = 'clients_pkey',
  /** unique or primary key constraint on columns "user_id" */
  ClientsUserIdKey = 'clients_user_id_key'
}

/** input type for inserting data into table "clients" */
export type Clients_Insert_Input = {
  client_addresses?: InputMaybe<Client_Addresses_Arr_Rel_Insert_Input>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  order_holds?: InputMaybe<Order_Holds_Arr_Rel_Insert_Input>;
  orders?: InputMaybe<Orders_Arr_Rel_Insert_Input>;
  ratings_received?: InputMaybe<Ratings_Arr_Rel_Insert_Input>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type Clients_Max_Fields = {
  __typename?: 'clients_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type Clients_Min_Fields = {
  __typename?: 'clients_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "clients" */
export type Clients_Mutation_Response = {
  __typename?: 'clients_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Clients>;
};

/** input type for inserting object relation for remote table "clients" */
export type Clients_Obj_Rel_Insert_Input = {
  data: Clients_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Clients_On_Conflict>;
};

/** on_conflict condition type for table "clients" */
export type Clients_On_Conflict = {
  constraint: Clients_Constraint;
  update_columns?: Array<Clients_Update_Column>;
  where?: InputMaybe<Clients_Bool_Exp>;
};

/** Ordering options when selecting data from "clients". */
export type Clients_Order_By = {
  client_addresses_aggregate?: InputMaybe<Client_Addresses_Aggregate_Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_holds_aggregate?: InputMaybe<Order_Holds_Aggregate_Order_By>;
  orders_aggregate?: InputMaybe<Orders_Aggregate_Order_By>;
  ratings_received_aggregate?: InputMaybe<Ratings_Aggregate_Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: clients */
export type Clients_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "clients" */
export enum Clients_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

/** input type for updating data in table "clients" */
export type Clients_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** Streaming cursor of the table "clients" */
export type Clients_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Clients_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Clients_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "clients" */
export enum Clients_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

export type Clients_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Clients_Set_Input>;
  /** filter the rows which have to be updated */
  where: Clients_Bool_Exp;
};

/** Boolean expression to compare columns of type "currency_enum". All fields are combined with logical 'AND'. */
export type Currency_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['currency_enum']['input']>;
  _gt?: InputMaybe<Scalars['currency_enum']['input']>;
  _gte?: InputMaybe<Scalars['currency_enum']['input']>;
  _in?: InputMaybe<Array<Scalars['currency_enum']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['currency_enum']['input']>;
  _lte?: InputMaybe<Scalars['currency_enum']['input']>;
  _neq?: InputMaybe<Scalars['currency_enum']['input']>;
  _nin?: InputMaybe<Array<Scalars['currency_enum']['input']>>;
};

/** ordering argument of a cursor */
export enum Cursor_Ordering {
  /** ascending ordering of the cursor */
  Asc = 'ASC',
  /** descending ordering of the cursor */
  Desc = 'DESC'
}

/** Boolean expression to compare columns of type "date". All fields are combined with logical 'AND'. */
export type Date_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['date']['input']>;
  _gt?: InputMaybe<Scalars['date']['input']>;
  _gte?: InputMaybe<Scalars['date']['input']>;
  _in?: InputMaybe<Array<Scalars['date']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['date']['input']>;
  _lte?: InputMaybe<Scalars['date']['input']>;
  _neq?: InputMaybe<Scalars['date']['input']>;
  _nin?: InputMaybe<Array<Scalars['date']['input']>>;
};

/** columns and relationships of "delivery_fees" */
export type Delivery_Fees = {
  __typename?: 'delivery_fees';
  conditions?: Maybe<Scalars['jsonb']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency: Scalars['currency_enum']['output'];
  fee: Scalars['numeric']['output'];
  id: Scalars['uuid']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};


/** columns and relationships of "delivery_fees" */
export type Delivery_FeesConditionsArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "delivery_fees" */
export type Delivery_Fees_Aggregate = {
  __typename?: 'delivery_fees_aggregate';
  aggregate?: Maybe<Delivery_Fees_Aggregate_Fields>;
  nodes: Array<Delivery_Fees>;
};

/** aggregate fields of "delivery_fees" */
export type Delivery_Fees_Aggregate_Fields = {
  __typename?: 'delivery_fees_aggregate_fields';
  avg?: Maybe<Delivery_Fees_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Delivery_Fees_Max_Fields>;
  min?: Maybe<Delivery_Fees_Min_Fields>;
  stddev?: Maybe<Delivery_Fees_Stddev_Fields>;
  stddev_pop?: Maybe<Delivery_Fees_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Delivery_Fees_Stddev_Samp_Fields>;
  sum?: Maybe<Delivery_Fees_Sum_Fields>;
  var_pop?: Maybe<Delivery_Fees_Var_Pop_Fields>;
  var_samp?: Maybe<Delivery_Fees_Var_Samp_Fields>;
  variance?: Maybe<Delivery_Fees_Variance_Fields>;
};


/** aggregate fields of "delivery_fees" */
export type Delivery_Fees_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Delivery_Fees_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Delivery_Fees_Append_Input = {
  conditions?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate avg on columns */
export type Delivery_Fees_Avg_Fields = {
  __typename?: 'delivery_fees_avg_fields';
  fee?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "delivery_fees". All fields are combined with a logical 'AND'. */
export type Delivery_Fees_Bool_Exp = {
  _and?: InputMaybe<Array<Delivery_Fees_Bool_Exp>>;
  _not?: InputMaybe<Delivery_Fees_Bool_Exp>;
  _or?: InputMaybe<Array<Delivery_Fees_Bool_Exp>>;
  conditions?: InputMaybe<Jsonb_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<Currency_Enum_Comparison_Exp>;
  fee?: InputMaybe<Numeric_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "delivery_fees" */
export enum Delivery_Fees_Constraint {
  /** unique or primary key constraint on columns "id" */
  DeliveryFeesPkey = 'delivery_fees_pkey'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Delivery_Fees_Delete_At_Path_Input = {
  conditions?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Delivery_Fees_Delete_Elem_Input = {
  conditions?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Delivery_Fees_Delete_Key_Input = {
  conditions?: InputMaybe<Scalars['String']['input']>;
};

/** input type for incrementing numeric columns in table "delivery_fees" */
export type Delivery_Fees_Inc_Input = {
  fee?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "delivery_fees" */
export type Delivery_Fees_Insert_Input = {
  conditions?: InputMaybe<Scalars['jsonb']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['currency_enum']['input']>;
  fee?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Delivery_Fees_Max_Fields = {
  __typename?: 'delivery_fees_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['currency_enum']['output']>;
  fee?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregate min on columns */
export type Delivery_Fees_Min_Fields = {
  __typename?: 'delivery_fees_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['currency_enum']['output']>;
  fee?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** response of any mutation on the table "delivery_fees" */
export type Delivery_Fees_Mutation_Response = {
  __typename?: 'delivery_fees_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Delivery_Fees>;
};

/** on_conflict condition type for table "delivery_fees" */
export type Delivery_Fees_On_Conflict = {
  constraint: Delivery_Fees_Constraint;
  update_columns?: Array<Delivery_Fees_Update_Column>;
  where?: InputMaybe<Delivery_Fees_Bool_Exp>;
};

/** Ordering options when selecting data from "delivery_fees". */
export type Delivery_Fees_Order_By = {
  conditions?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  fee?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: delivery_fees */
export type Delivery_Fees_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Delivery_Fees_Prepend_Input = {
  conditions?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "delivery_fees" */
export enum Delivery_Fees_Select_Column {
  /** column name */
  Conditions = 'conditions',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  Fee = 'fee',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "delivery_fees" */
export type Delivery_Fees_Set_Input = {
  conditions?: InputMaybe<Scalars['jsonb']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['currency_enum']['input']>;
  fee?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Delivery_Fees_Stddev_Fields = {
  __typename?: 'delivery_fees_stddev_fields';
  fee?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Delivery_Fees_Stddev_Pop_Fields = {
  __typename?: 'delivery_fees_stddev_pop_fields';
  fee?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Delivery_Fees_Stddev_Samp_Fields = {
  __typename?: 'delivery_fees_stddev_samp_fields';
  fee?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "delivery_fees" */
export type Delivery_Fees_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Delivery_Fees_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Delivery_Fees_Stream_Cursor_Value_Input = {
  conditions?: InputMaybe<Scalars['jsonb']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['currency_enum']['input']>;
  fee?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Delivery_Fees_Sum_Fields = {
  __typename?: 'delivery_fees_sum_fields';
  fee?: Maybe<Scalars['numeric']['output']>;
};

/** update columns of table "delivery_fees" */
export enum Delivery_Fees_Update_Column {
  /** column name */
  Conditions = 'conditions',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  Fee = 'fee',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Delivery_Fees_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Delivery_Fees_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Delivery_Fees_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Delivery_Fees_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Delivery_Fees_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Delivery_Fees_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Delivery_Fees_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Delivery_Fees_Set_Input>;
  /** filter the rows which have to be updated */
  where: Delivery_Fees_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Delivery_Fees_Var_Pop_Fields = {
  __typename?: 'delivery_fees_var_pop_fields';
  fee?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Delivery_Fees_Var_Samp_Fields = {
  __typename?: 'delivery_fees_var_samp_fields';
  fee?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Delivery_Fees_Variance_Fields = {
  __typename?: 'delivery_fees_variance_fields';
  fee?: Maybe<Scalars['Float']['output']>;
};

/** Updated state names to include Province suffix */
export type Delivery_Time_Slots = {
  __typename?: 'delivery_time_slots';
  country_code: Scalars['bpchar']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  /** An array relationship */
  delivery_time_windows: Array<Delivery_Time_Windows>;
  /** An aggregate relationship */
  delivery_time_windows_aggregate: Delivery_Time_Windows_Aggregate;
  display_order?: Maybe<Scalars['Int']['output']>;
  end_time: Scalars['time']['output'];
  id: Scalars['uuid']['output'];
  is_active?: Maybe<Scalars['Boolean']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Int']['output']>;
  slot_name: Scalars['String']['output'];
  /** Type of delivery: standard (24-48h) or fast (2-4h) */
  slot_type: Scalars['String']['output'];
  start_time: Scalars['time']['output'];
  /** State/province name (e.g., "Estuaire Province") */
  state?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};


/** Updated state names to include Province suffix */
export type Delivery_Time_SlotsDelivery_Time_WindowsArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


/** Updated state names to include Province suffix */
export type Delivery_Time_SlotsDelivery_Time_Windows_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};

/** aggregated selection of "delivery_time_slots" */
export type Delivery_Time_Slots_Aggregate = {
  __typename?: 'delivery_time_slots_aggregate';
  aggregate?: Maybe<Delivery_Time_Slots_Aggregate_Fields>;
  nodes: Array<Delivery_Time_Slots>;
};

/** aggregate fields of "delivery_time_slots" */
export type Delivery_Time_Slots_Aggregate_Fields = {
  __typename?: 'delivery_time_slots_aggregate_fields';
  avg?: Maybe<Delivery_Time_Slots_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Delivery_Time_Slots_Max_Fields>;
  min?: Maybe<Delivery_Time_Slots_Min_Fields>;
  stddev?: Maybe<Delivery_Time_Slots_Stddev_Fields>;
  stddev_pop?: Maybe<Delivery_Time_Slots_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Delivery_Time_Slots_Stddev_Samp_Fields>;
  sum?: Maybe<Delivery_Time_Slots_Sum_Fields>;
  var_pop?: Maybe<Delivery_Time_Slots_Var_Pop_Fields>;
  var_samp?: Maybe<Delivery_Time_Slots_Var_Samp_Fields>;
  variance?: Maybe<Delivery_Time_Slots_Variance_Fields>;
};


/** aggregate fields of "delivery_time_slots" */
export type Delivery_Time_Slots_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Delivery_Time_Slots_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Delivery_Time_Slots_Avg_Fields = {
  __typename?: 'delivery_time_slots_avg_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "delivery_time_slots". All fields are combined with a logical 'AND'. */
export type Delivery_Time_Slots_Bool_Exp = {
  _and?: InputMaybe<Array<Delivery_Time_Slots_Bool_Exp>>;
  _not?: InputMaybe<Delivery_Time_Slots_Bool_Exp>;
  _or?: InputMaybe<Array<Delivery_Time_Slots_Bool_Exp>>;
  country_code?: InputMaybe<Bpchar_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  delivery_time_windows?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
  delivery_time_windows_aggregate?: InputMaybe<Delivery_Time_Windows_Aggregate_Bool_Exp>;
  display_order?: InputMaybe<Int_Comparison_Exp>;
  end_time?: InputMaybe<Time_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_active?: InputMaybe<Boolean_Comparison_Exp>;
  max_orders_per_slot?: InputMaybe<Int_Comparison_Exp>;
  slot_name?: InputMaybe<String_Comparison_Exp>;
  slot_type?: InputMaybe<String_Comparison_Exp>;
  start_time?: InputMaybe<Time_Comparison_Exp>;
  state?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "delivery_time_slots" */
export enum Delivery_Time_Slots_Constraint {
  /** unique or primary key constraint on columns "id" */
  DeliveryTimeSlotsPkey = 'delivery_time_slots_pkey',
  /** unique or primary key constraint on columns "slot_name", "state", "country_code", "slot_type" */
  UniqueSlotPerLocation = 'unique_slot_per_location'
}

/** input type for incrementing numeric columns in table "delivery_time_slots" */
export type Delivery_Time_Slots_Inc_Input = {
  display_order?: InputMaybe<Scalars['Int']['input']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "delivery_time_slots" */
export type Delivery_Time_Slots_Insert_Input = {
  country_code?: InputMaybe<Scalars['bpchar']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  delivery_time_windows?: InputMaybe<Delivery_Time_Windows_Arr_Rel_Insert_Input>;
  display_order?: InputMaybe<Scalars['Int']['input']>;
  end_time?: InputMaybe<Scalars['time']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: InputMaybe<Scalars['Int']['input']>;
  slot_name?: InputMaybe<Scalars['String']['input']>;
  /** Type of delivery: standard (24-48h) or fast (2-4h) */
  slot_type?: InputMaybe<Scalars['String']['input']>;
  start_time?: InputMaybe<Scalars['time']['input']>;
  /** State/province name (e.g., "Estuaire Province") */
  state?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Delivery_Time_Slots_Max_Fields = {
  __typename?: 'delivery_time_slots_max_fields';
  country_code?: Maybe<Scalars['bpchar']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  display_order?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Int']['output']>;
  slot_name?: Maybe<Scalars['String']['output']>;
  /** Type of delivery: standard (24-48h) or fast (2-4h) */
  slot_type?: Maybe<Scalars['String']['output']>;
  /** State/province name (e.g., "Estuaire Province") */
  state?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregate min on columns */
export type Delivery_Time_Slots_Min_Fields = {
  __typename?: 'delivery_time_slots_min_fields';
  country_code?: Maybe<Scalars['bpchar']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  display_order?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Int']['output']>;
  slot_name?: Maybe<Scalars['String']['output']>;
  /** Type of delivery: standard (24-48h) or fast (2-4h) */
  slot_type?: Maybe<Scalars['String']['output']>;
  /** State/province name (e.g., "Estuaire Province") */
  state?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** response of any mutation on the table "delivery_time_slots" */
export type Delivery_Time_Slots_Mutation_Response = {
  __typename?: 'delivery_time_slots_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Delivery_Time_Slots>;
};

/** input type for inserting object relation for remote table "delivery_time_slots" */
export type Delivery_Time_Slots_Obj_Rel_Insert_Input = {
  data: Delivery_Time_Slots_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Delivery_Time_Slots_On_Conflict>;
};

/** on_conflict condition type for table "delivery_time_slots" */
export type Delivery_Time_Slots_On_Conflict = {
  constraint: Delivery_Time_Slots_Constraint;
  update_columns?: Array<Delivery_Time_Slots_Update_Column>;
  where?: InputMaybe<Delivery_Time_Slots_Bool_Exp>;
};

/** Ordering options when selecting data from "delivery_time_slots". */
export type Delivery_Time_Slots_Order_By = {
  country_code?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  delivery_time_windows_aggregate?: InputMaybe<Delivery_Time_Windows_Aggregate_Order_By>;
  display_order?: InputMaybe<Order_By>;
  end_time?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_active?: InputMaybe<Order_By>;
  max_orders_per_slot?: InputMaybe<Order_By>;
  slot_name?: InputMaybe<Order_By>;
  slot_type?: InputMaybe<Order_By>;
  start_time?: InputMaybe<Order_By>;
  state?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: delivery_time_slots */
export type Delivery_Time_Slots_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "delivery_time_slots" */
export enum Delivery_Time_Slots_Select_Column {
  /** column name */
  CountryCode = 'country_code',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  DisplayOrder = 'display_order',
  /** column name */
  EndTime = 'end_time',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  MaxOrdersPerSlot = 'max_orders_per_slot',
  /** column name */
  SlotName = 'slot_name',
  /** column name */
  SlotType = 'slot_type',
  /** column name */
  StartTime = 'start_time',
  /** column name */
  State = 'state',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "delivery_time_slots" */
export type Delivery_Time_Slots_Set_Input = {
  country_code?: InputMaybe<Scalars['bpchar']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  display_order?: InputMaybe<Scalars['Int']['input']>;
  end_time?: InputMaybe<Scalars['time']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: InputMaybe<Scalars['Int']['input']>;
  slot_name?: InputMaybe<Scalars['String']['input']>;
  /** Type of delivery: standard (24-48h) or fast (2-4h) */
  slot_type?: InputMaybe<Scalars['String']['input']>;
  start_time?: InputMaybe<Scalars['time']['input']>;
  /** State/province name (e.g., "Estuaire Province") */
  state?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Delivery_Time_Slots_Stddev_Fields = {
  __typename?: 'delivery_time_slots_stddev_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Delivery_Time_Slots_Stddev_Pop_Fields = {
  __typename?: 'delivery_time_slots_stddev_pop_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Delivery_Time_Slots_Stddev_Samp_Fields = {
  __typename?: 'delivery_time_slots_stddev_samp_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "delivery_time_slots" */
export type Delivery_Time_Slots_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Delivery_Time_Slots_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Delivery_Time_Slots_Stream_Cursor_Value_Input = {
  country_code?: InputMaybe<Scalars['bpchar']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  display_order?: InputMaybe<Scalars['Int']['input']>;
  end_time?: InputMaybe<Scalars['time']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: InputMaybe<Scalars['Int']['input']>;
  slot_name?: InputMaybe<Scalars['String']['input']>;
  /** Type of delivery: standard (24-48h) or fast (2-4h) */
  slot_type?: InputMaybe<Scalars['String']['input']>;
  start_time?: InputMaybe<Scalars['time']['input']>;
  /** State/province name (e.g., "Estuaire Province") */
  state?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Delivery_Time_Slots_Sum_Fields = {
  __typename?: 'delivery_time_slots_sum_fields';
  display_order?: Maybe<Scalars['Int']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "delivery_time_slots" */
export enum Delivery_Time_Slots_Update_Column {
  /** column name */
  CountryCode = 'country_code',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  DisplayOrder = 'display_order',
  /** column name */
  EndTime = 'end_time',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  MaxOrdersPerSlot = 'max_orders_per_slot',
  /** column name */
  SlotName = 'slot_name',
  /** column name */
  SlotType = 'slot_type',
  /** column name */
  StartTime = 'start_time',
  /** column name */
  State = 'state',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Delivery_Time_Slots_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Delivery_Time_Slots_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Delivery_Time_Slots_Set_Input>;
  /** filter the rows which have to be updated */
  where: Delivery_Time_Slots_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Delivery_Time_Slots_Var_Pop_Fields = {
  __typename?: 'delivery_time_slots_var_pop_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Delivery_Time_Slots_Var_Samp_Fields = {
  __typename?: 'delivery_time_slots_var_samp_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Delivery_Time_Slots_Variance_Fields = {
  __typename?: 'delivery_time_slots_variance_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  /** Maximum number of orders that can be booked for this slot per day */
  max_orders_per_slot?: Maybe<Scalars['Float']['output']>;
};

/** Client delivery time preferences per order */
export type Delivery_Time_Windows = {
  __typename?: 'delivery_time_windows';
  /** An object relationship */
  confirmedByUser?: Maybe<Users>;
  confirmed_at?: Maybe<Scalars['timestamptz']['output']>;
  /** User ID who confirmed the delivery window */
  confirmed_by?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id: Scalars['uuid']['output'];
  /** Whether the delivery window has been confirmed by the business */
  is_confirmed?: Maybe<Scalars['Boolean']['output']>;
  /** An object relationship */
  order: Orders;
  order_id: Scalars['uuid']['output'];
  preferred_date: Scalars['date']['output'];
  /** An object relationship */
  slot: Delivery_Time_Slots;
  slot_id: Scalars['uuid']['output'];
  special_instructions?: Maybe<Scalars['String']['output']>;
  time_slot_end: Scalars['time']['output'];
  time_slot_start: Scalars['time']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregated selection of "delivery_time_windows" */
export type Delivery_Time_Windows_Aggregate = {
  __typename?: 'delivery_time_windows_aggregate';
  aggregate?: Maybe<Delivery_Time_Windows_Aggregate_Fields>;
  nodes: Array<Delivery_Time_Windows>;
};

export type Delivery_Time_Windows_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Delivery_Time_Windows_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Delivery_Time_Windows_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Delivery_Time_Windows_Aggregate_Bool_Exp_Count>;
};

export type Delivery_Time_Windows_Aggregate_Bool_Exp_Bool_And = {
  arguments: Delivery_Time_Windows_Select_Column_Delivery_Time_Windows_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Delivery_Time_Windows_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Delivery_Time_Windows_Select_Column_Delivery_Time_Windows_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Delivery_Time_Windows_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "delivery_time_windows" */
export type Delivery_Time_Windows_Aggregate_Fields = {
  __typename?: 'delivery_time_windows_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Delivery_Time_Windows_Max_Fields>;
  min?: Maybe<Delivery_Time_Windows_Min_Fields>;
};


/** aggregate fields of "delivery_time_windows" */
export type Delivery_Time_Windows_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "delivery_time_windows" */
export type Delivery_Time_Windows_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Delivery_Time_Windows_Max_Order_By>;
  min?: InputMaybe<Delivery_Time_Windows_Min_Order_By>;
};

/** input type for inserting array relation for remote table "delivery_time_windows" */
export type Delivery_Time_Windows_Arr_Rel_Insert_Input = {
  data: Array<Delivery_Time_Windows_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Delivery_Time_Windows_On_Conflict>;
};

/** Boolean expression to filter rows from the table "delivery_time_windows". All fields are combined with a logical 'AND'. */
export type Delivery_Time_Windows_Bool_Exp = {
  _and?: InputMaybe<Array<Delivery_Time_Windows_Bool_Exp>>;
  _not?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
  _or?: InputMaybe<Array<Delivery_Time_Windows_Bool_Exp>>;
  confirmedByUser?: InputMaybe<Users_Bool_Exp>;
  confirmed_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  confirmed_by?: InputMaybe<Uuid_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_confirmed?: InputMaybe<Boolean_Comparison_Exp>;
  order?: InputMaybe<Orders_Bool_Exp>;
  order_id?: InputMaybe<Uuid_Comparison_Exp>;
  preferred_date?: InputMaybe<Date_Comparison_Exp>;
  slot?: InputMaybe<Delivery_Time_Slots_Bool_Exp>;
  slot_id?: InputMaybe<Uuid_Comparison_Exp>;
  special_instructions?: InputMaybe<String_Comparison_Exp>;
  time_slot_end?: InputMaybe<Time_Comparison_Exp>;
  time_slot_start?: InputMaybe<Time_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "delivery_time_windows" */
export enum Delivery_Time_Windows_Constraint {
  /** unique or primary key constraint on columns "id" */
  DeliveryTimeWindowsPkey = 'delivery_time_windows_pkey',
  /** unique or primary key constraint on columns "order_id" */
  UniqueOrderWindow = 'unique_order_window'
}

/** input type for inserting data into table "delivery_time_windows" */
export type Delivery_Time_Windows_Insert_Input = {
  confirmedByUser?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  confirmed_at?: InputMaybe<Scalars['timestamptz']['input']>;
  /** User ID who confirmed the delivery window */
  confirmed_by?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Whether the delivery window has been confirmed by the business */
  is_confirmed?: InputMaybe<Scalars['Boolean']['input']>;
  order?: InputMaybe<Orders_Obj_Rel_Insert_Input>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  preferred_date?: InputMaybe<Scalars['date']['input']>;
  slot?: InputMaybe<Delivery_Time_Slots_Obj_Rel_Insert_Input>;
  slot_id?: InputMaybe<Scalars['uuid']['input']>;
  special_instructions?: InputMaybe<Scalars['String']['input']>;
  time_slot_end?: InputMaybe<Scalars['time']['input']>;
  time_slot_start?: InputMaybe<Scalars['time']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Delivery_Time_Windows_Max_Fields = {
  __typename?: 'delivery_time_windows_max_fields';
  confirmed_at?: Maybe<Scalars['timestamptz']['output']>;
  /** User ID who confirmed the delivery window */
  confirmed_by?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  preferred_date?: Maybe<Scalars['date']['output']>;
  slot_id?: Maybe<Scalars['uuid']['output']>;
  special_instructions?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "delivery_time_windows" */
export type Delivery_Time_Windows_Max_Order_By = {
  confirmed_at?: InputMaybe<Order_By>;
  /** User ID who confirmed the delivery window */
  confirmed_by?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  preferred_date?: InputMaybe<Order_By>;
  slot_id?: InputMaybe<Order_By>;
  special_instructions?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Delivery_Time_Windows_Min_Fields = {
  __typename?: 'delivery_time_windows_min_fields';
  confirmed_at?: Maybe<Scalars['timestamptz']['output']>;
  /** User ID who confirmed the delivery window */
  confirmed_by?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  preferred_date?: Maybe<Scalars['date']['output']>;
  slot_id?: Maybe<Scalars['uuid']['output']>;
  special_instructions?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "delivery_time_windows" */
export type Delivery_Time_Windows_Min_Order_By = {
  confirmed_at?: InputMaybe<Order_By>;
  /** User ID who confirmed the delivery window */
  confirmed_by?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  preferred_date?: InputMaybe<Order_By>;
  slot_id?: InputMaybe<Order_By>;
  special_instructions?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "delivery_time_windows" */
export type Delivery_Time_Windows_Mutation_Response = {
  __typename?: 'delivery_time_windows_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Delivery_Time_Windows>;
};

/** input type for inserting object relation for remote table "delivery_time_windows" */
export type Delivery_Time_Windows_Obj_Rel_Insert_Input = {
  data: Delivery_Time_Windows_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Delivery_Time_Windows_On_Conflict>;
};

/** on_conflict condition type for table "delivery_time_windows" */
export type Delivery_Time_Windows_On_Conflict = {
  constraint: Delivery_Time_Windows_Constraint;
  update_columns?: Array<Delivery_Time_Windows_Update_Column>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};

/** Ordering options when selecting data from "delivery_time_windows". */
export type Delivery_Time_Windows_Order_By = {
  confirmedByUser?: InputMaybe<Users_Order_By>;
  confirmed_at?: InputMaybe<Order_By>;
  confirmed_by?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_confirmed?: InputMaybe<Order_By>;
  order?: InputMaybe<Orders_Order_By>;
  order_id?: InputMaybe<Order_By>;
  preferred_date?: InputMaybe<Order_By>;
  slot?: InputMaybe<Delivery_Time_Slots_Order_By>;
  slot_id?: InputMaybe<Order_By>;
  special_instructions?: InputMaybe<Order_By>;
  time_slot_end?: InputMaybe<Order_By>;
  time_slot_start?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: delivery_time_windows */
export type Delivery_Time_Windows_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "delivery_time_windows" */
export enum Delivery_Time_Windows_Select_Column {
  /** column name */
  ConfirmedAt = 'confirmed_at',
  /** column name */
  ConfirmedBy = 'confirmed_by',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsConfirmed = 'is_confirmed',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  PreferredDate = 'preferred_date',
  /** column name */
  SlotId = 'slot_id',
  /** column name */
  SpecialInstructions = 'special_instructions',
  /** column name */
  TimeSlotEnd = 'time_slot_end',
  /** column name */
  TimeSlotStart = 'time_slot_start',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** select "delivery_time_windows_aggregate_bool_exp_bool_and_arguments_columns" columns of table "delivery_time_windows" */
export enum Delivery_Time_Windows_Select_Column_Delivery_Time_Windows_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsConfirmed = 'is_confirmed'
}

/** select "delivery_time_windows_aggregate_bool_exp_bool_or_arguments_columns" columns of table "delivery_time_windows" */
export enum Delivery_Time_Windows_Select_Column_Delivery_Time_Windows_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsConfirmed = 'is_confirmed'
}

/** input type for updating data in table "delivery_time_windows" */
export type Delivery_Time_Windows_Set_Input = {
  confirmed_at?: InputMaybe<Scalars['timestamptz']['input']>;
  /** User ID who confirmed the delivery window */
  confirmed_by?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Whether the delivery window has been confirmed by the business */
  is_confirmed?: InputMaybe<Scalars['Boolean']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  preferred_date?: InputMaybe<Scalars['date']['input']>;
  slot_id?: InputMaybe<Scalars['uuid']['input']>;
  special_instructions?: InputMaybe<Scalars['String']['input']>;
  time_slot_end?: InputMaybe<Scalars['time']['input']>;
  time_slot_start?: InputMaybe<Scalars['time']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** Streaming cursor of the table "delivery_time_windows" */
export type Delivery_Time_Windows_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Delivery_Time_Windows_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Delivery_Time_Windows_Stream_Cursor_Value_Input = {
  confirmed_at?: InputMaybe<Scalars['timestamptz']['input']>;
  /** User ID who confirmed the delivery window */
  confirmed_by?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  /** Whether the delivery window has been confirmed by the business */
  is_confirmed?: InputMaybe<Scalars['Boolean']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  preferred_date?: InputMaybe<Scalars['date']['input']>;
  slot_id?: InputMaybe<Scalars['uuid']['input']>;
  special_instructions?: InputMaybe<Scalars['String']['input']>;
  time_slot_end?: InputMaybe<Scalars['time']['input']>;
  time_slot_start?: InputMaybe<Scalars['time']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** update columns of table "delivery_time_windows" */
export enum Delivery_Time_Windows_Update_Column {
  /** column name */
  ConfirmedAt = 'confirmed_at',
  /** column name */
  ConfirmedBy = 'confirmed_by',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsConfirmed = 'is_confirmed',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  PreferredDate = 'preferred_date',
  /** column name */
  SlotId = 'slot_id',
  /** column name */
  SpecialInstructions = 'special_instructions',
  /** column name */
  TimeSlotEnd = 'time_slot_end',
  /** column name */
  TimeSlotStart = 'time_slot_start',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Delivery_Time_Windows_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Delivery_Time_Windows_Set_Input>;
  /** filter the rows which have to be updated */
  where: Delivery_Time_Windows_Bool_Exp;
};

/** columns and relationships of "document_types" */
export type Document_Types = {
  __typename?: 'document_types';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  /** An array relationship */
  user_uploads: Array<User_Uploads>;
  /** An aggregate relationship */
  user_uploads_aggregate: User_Uploads_Aggregate;
};


/** columns and relationships of "document_types" */
export type Document_TypesUser_UploadsArgs = {
  distinct_on?: InputMaybe<Array<User_Uploads_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Uploads_Order_By>>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};


/** columns and relationships of "document_types" */
export type Document_TypesUser_Uploads_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Uploads_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Uploads_Order_By>>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};

/** aggregated selection of "document_types" */
export type Document_Types_Aggregate = {
  __typename?: 'document_types_aggregate';
  aggregate?: Maybe<Document_Types_Aggregate_Fields>;
  nodes: Array<Document_Types>;
};

/** aggregate fields of "document_types" */
export type Document_Types_Aggregate_Fields = {
  __typename?: 'document_types_aggregate_fields';
  avg?: Maybe<Document_Types_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Document_Types_Max_Fields>;
  min?: Maybe<Document_Types_Min_Fields>;
  stddev?: Maybe<Document_Types_Stddev_Fields>;
  stddev_pop?: Maybe<Document_Types_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Document_Types_Stddev_Samp_Fields>;
  sum?: Maybe<Document_Types_Sum_Fields>;
  var_pop?: Maybe<Document_Types_Var_Pop_Fields>;
  var_samp?: Maybe<Document_Types_Var_Samp_Fields>;
  variance?: Maybe<Document_Types_Variance_Fields>;
};


/** aggregate fields of "document_types" */
export type Document_Types_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Document_Types_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Document_Types_Avg_Fields = {
  __typename?: 'document_types_avg_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "document_types". All fields are combined with a logical 'AND'. */
export type Document_Types_Bool_Exp = {
  _and?: InputMaybe<Array<Document_Types_Bool_Exp>>;
  _not?: InputMaybe<Document_Types_Bool_Exp>;
  _or?: InputMaybe<Array<Document_Types_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Int_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user_uploads?: InputMaybe<User_Uploads_Bool_Exp>;
  user_uploads_aggregate?: InputMaybe<User_Uploads_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "document_types" */
export enum Document_Types_Constraint {
  /** unique or primary key constraint on columns "name" */
  DocumentTypesNameKey = 'document_types_name_key',
  /** unique or primary key constraint on columns "id" */
  DocumentTypesPkey = 'document_types_pkey'
}

/** input type for incrementing numeric columns in table "document_types" */
export type Document_Types_Inc_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "document_types" */
export type Document_Types_Insert_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_uploads?: InputMaybe<User_Uploads_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Document_Types_Max_Fields = {
  __typename?: 'document_types_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregate min on columns */
export type Document_Types_Min_Fields = {
  __typename?: 'document_types_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** response of any mutation on the table "document_types" */
export type Document_Types_Mutation_Response = {
  __typename?: 'document_types_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Document_Types>;
};

/** input type for inserting object relation for remote table "document_types" */
export type Document_Types_Obj_Rel_Insert_Input = {
  data: Document_Types_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Document_Types_On_Conflict>;
};

/** on_conflict condition type for table "document_types" */
export type Document_Types_On_Conflict = {
  constraint: Document_Types_Constraint;
  update_columns?: Array<Document_Types_Update_Column>;
  where?: InputMaybe<Document_Types_Bool_Exp>;
};

/** Ordering options when selecting data from "document_types". */
export type Document_Types_Order_By = {
  created_at?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_uploads_aggregate?: InputMaybe<User_Uploads_Aggregate_Order_By>;
};

/** primary key columns input for table: document_types */
export type Document_Types_Pk_Columns_Input = {
  id: Scalars['Int']['input'];
};

/** select columns of table "document_types" */
export enum Document_Types_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "document_types" */
export type Document_Types_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Document_Types_Stddev_Fields = {
  __typename?: 'document_types_stddev_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Document_Types_Stddev_Pop_Fields = {
  __typename?: 'document_types_stddev_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Document_Types_Stddev_Samp_Fields = {
  __typename?: 'document_types_stddev_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "document_types" */
export type Document_Types_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Document_Types_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Document_Types_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Document_Types_Sum_Fields = {
  __typename?: 'document_types_sum_fields';
  id?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "document_types" */
export enum Document_Types_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Document_Types_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Document_Types_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Document_Types_Set_Input>;
  /** filter the rows which have to be updated */
  where: Document_Types_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Document_Types_Var_Pop_Fields = {
  __typename?: 'document_types_var_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Document_Types_Var_Samp_Fields = {
  __typename?: 'document_types_var_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Document_Types_Variance_Fields = {
  __typename?: 'document_types_variance_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "entity_types" */
export type Entity_Types = {
  __typename?: 'entity_types';
  comment: Scalars['String']['output'];
  id: Scalars['String']['output'];
  /** An array relationship */
  user_messages: Array<User_Messages>;
  /** An aggregate relationship */
  user_messages_aggregate: User_Messages_Aggregate;
};


/** columns and relationships of "entity_types" */
export type Entity_TypesUser_MessagesArgs = {
  distinct_on?: InputMaybe<Array<User_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Messages_Order_By>>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};


/** columns and relationships of "entity_types" */
export type Entity_TypesUser_Messages_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Messages_Order_By>>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};

/** aggregated selection of "entity_types" */
export type Entity_Types_Aggregate = {
  __typename?: 'entity_types_aggregate';
  aggregate?: Maybe<Entity_Types_Aggregate_Fields>;
  nodes: Array<Entity_Types>;
};

/** aggregate fields of "entity_types" */
export type Entity_Types_Aggregate_Fields = {
  __typename?: 'entity_types_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Entity_Types_Max_Fields>;
  min?: Maybe<Entity_Types_Min_Fields>;
};


/** aggregate fields of "entity_types" */
export type Entity_Types_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Entity_Types_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "entity_types". All fields are combined with a logical 'AND'. */
export type Entity_Types_Bool_Exp = {
  _and?: InputMaybe<Array<Entity_Types_Bool_Exp>>;
  _not?: InputMaybe<Entity_Types_Bool_Exp>;
  _or?: InputMaybe<Array<Entity_Types_Bool_Exp>>;
  comment?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  user_messages?: InputMaybe<User_Messages_Bool_Exp>;
  user_messages_aggregate?: InputMaybe<User_Messages_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "entity_types" */
export enum Entity_Types_Constraint {
  /** unique or primary key constraint on columns "id" */
  EntityTypesPkey = 'entity_types_pkey'
}

export enum Entity_Types_Enum {
  /** Account related messages */
  Account = 'account',
  /** Address related messages */
  Address = 'address',
  /** Agent related messages */
  Agent = 'agent',
  /** Business related messages */
  Business = 'business',
  /** Client related messages */
  Client = 'client',
  /** Document related messages */
  Document = 'document',
  /** Item related messages */
  Item = 'item',
  /** Order related messages */
  Order = 'order'
}

/** Boolean expression to compare columns of type "entity_types_enum". All fields are combined with logical 'AND'. */
export type Entity_Types_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Entity_Types_Enum>;
  _in?: InputMaybe<Array<Entity_Types_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<Entity_Types_Enum>;
  _nin?: InputMaybe<Array<Entity_Types_Enum>>;
};

/** input type for inserting data into table "entity_types" */
export type Entity_Types_Insert_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  user_messages?: InputMaybe<User_Messages_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Entity_Types_Max_Fields = {
  __typename?: 'entity_types_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Entity_Types_Min_Fields = {
  __typename?: 'entity_types_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "entity_types" */
export type Entity_Types_Mutation_Response = {
  __typename?: 'entity_types_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Entity_Types>;
};

/** input type for inserting object relation for remote table "entity_types" */
export type Entity_Types_Obj_Rel_Insert_Input = {
  data: Entity_Types_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Entity_Types_On_Conflict>;
};

/** on_conflict condition type for table "entity_types" */
export type Entity_Types_On_Conflict = {
  constraint: Entity_Types_Constraint;
  update_columns?: Array<Entity_Types_Update_Column>;
  where?: InputMaybe<Entity_Types_Bool_Exp>;
};

/** Ordering options when selecting data from "entity_types". */
export type Entity_Types_Order_By = {
  comment?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  user_messages_aggregate?: InputMaybe<User_Messages_Aggregate_Order_By>;
};

/** primary key columns input for table: entity_types */
export type Entity_Types_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "entity_types" */
export enum Entity_Types_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Id = 'id'
}

/** input type for updating data in table "entity_types" */
export type Entity_Types_Set_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "entity_types" */
export type Entity_Types_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Entity_Types_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Entity_Types_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "entity_types" */
export enum Entity_Types_Update_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Id = 'id'
}

export type Entity_Types_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Entity_Types_Set_Input>;
  /** filter the rows which have to be updated */
  where: Entity_Types_Bool_Exp;
};

/** columns and relationships of "google_distance_cache" */
export type Google_Distance_Cache = {
  __typename?: 'google_distance_cache';
  created_at: Scalars['timestamptz']['output'];
  destination_address_formatted: Scalars['String']['output'];
  destination_address_id: Scalars['uuid']['output'];
  distance_text?: Maybe<Scalars['String']['output']>;
  distance_value?: Maybe<Scalars['Int']['output']>;
  duration_text?: Maybe<Scalars['String']['output']>;
  duration_value?: Maybe<Scalars['Int']['output']>;
  expires_at: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  origin_address_formatted: Scalars['String']['output'];
  origin_address_id: Scalars['uuid']['output'];
  status: Scalars['String']['output'];
};

/** aggregated selection of "google_distance_cache" */
export type Google_Distance_Cache_Aggregate = {
  __typename?: 'google_distance_cache_aggregate';
  aggregate?: Maybe<Google_Distance_Cache_Aggregate_Fields>;
  nodes: Array<Google_Distance_Cache>;
};

/** aggregate fields of "google_distance_cache" */
export type Google_Distance_Cache_Aggregate_Fields = {
  __typename?: 'google_distance_cache_aggregate_fields';
  avg?: Maybe<Google_Distance_Cache_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Google_Distance_Cache_Max_Fields>;
  min?: Maybe<Google_Distance_Cache_Min_Fields>;
  stddev?: Maybe<Google_Distance_Cache_Stddev_Fields>;
  stddev_pop?: Maybe<Google_Distance_Cache_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Google_Distance_Cache_Stddev_Samp_Fields>;
  sum?: Maybe<Google_Distance_Cache_Sum_Fields>;
  var_pop?: Maybe<Google_Distance_Cache_Var_Pop_Fields>;
  var_samp?: Maybe<Google_Distance_Cache_Var_Samp_Fields>;
  variance?: Maybe<Google_Distance_Cache_Variance_Fields>;
};


/** aggregate fields of "google_distance_cache" */
export type Google_Distance_Cache_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Google_Distance_Cache_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Google_Distance_Cache_Avg_Fields = {
  __typename?: 'google_distance_cache_avg_fields';
  distance_value?: Maybe<Scalars['Float']['output']>;
  duration_value?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "google_distance_cache". All fields are combined with a logical 'AND'. */
export type Google_Distance_Cache_Bool_Exp = {
  _and?: InputMaybe<Array<Google_Distance_Cache_Bool_Exp>>;
  _not?: InputMaybe<Google_Distance_Cache_Bool_Exp>;
  _or?: InputMaybe<Array<Google_Distance_Cache_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  destination_address_formatted?: InputMaybe<String_Comparison_Exp>;
  destination_address_id?: InputMaybe<Uuid_Comparison_Exp>;
  distance_text?: InputMaybe<String_Comparison_Exp>;
  distance_value?: InputMaybe<Int_Comparison_Exp>;
  duration_text?: InputMaybe<String_Comparison_Exp>;
  duration_value?: InputMaybe<Int_Comparison_Exp>;
  expires_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  origin_address_formatted?: InputMaybe<String_Comparison_Exp>;
  origin_address_id?: InputMaybe<Uuid_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "google_distance_cache" */
export enum Google_Distance_Cache_Constraint {
  /** unique or primary key constraint on columns "origin_address_id", "destination_address_id" */
  GoogleDistanceCacheOriginAddressIdDestinationAddressKey = 'google_distance_cache_origin_address_id_destination_address_key',
  /** unique or primary key constraint on columns "id" */
  GoogleDistanceCachePkey = 'google_distance_cache_pkey'
}

/** input type for incrementing numeric columns in table "google_distance_cache" */
export type Google_Distance_Cache_Inc_Input = {
  distance_value?: InputMaybe<Scalars['Int']['input']>;
  duration_value?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "google_distance_cache" */
export type Google_Distance_Cache_Insert_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  destination_address_formatted?: InputMaybe<Scalars['String']['input']>;
  destination_address_id?: InputMaybe<Scalars['uuid']['input']>;
  distance_text?: InputMaybe<Scalars['String']['input']>;
  distance_value?: InputMaybe<Scalars['Int']['input']>;
  duration_text?: InputMaybe<Scalars['String']['input']>;
  duration_value?: InputMaybe<Scalars['Int']['input']>;
  expires_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  origin_address_formatted?: InputMaybe<Scalars['String']['input']>;
  origin_address_id?: InputMaybe<Scalars['uuid']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Google_Distance_Cache_Max_Fields = {
  __typename?: 'google_distance_cache_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  destination_address_formatted?: Maybe<Scalars['String']['output']>;
  destination_address_id?: Maybe<Scalars['uuid']['output']>;
  distance_text?: Maybe<Scalars['String']['output']>;
  distance_value?: Maybe<Scalars['Int']['output']>;
  duration_text?: Maybe<Scalars['String']['output']>;
  duration_value?: Maybe<Scalars['Int']['output']>;
  expires_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  origin_address_formatted?: Maybe<Scalars['String']['output']>;
  origin_address_id?: Maybe<Scalars['uuid']['output']>;
  status?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Google_Distance_Cache_Min_Fields = {
  __typename?: 'google_distance_cache_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  destination_address_formatted?: Maybe<Scalars['String']['output']>;
  destination_address_id?: Maybe<Scalars['uuid']['output']>;
  distance_text?: Maybe<Scalars['String']['output']>;
  distance_value?: Maybe<Scalars['Int']['output']>;
  duration_text?: Maybe<Scalars['String']['output']>;
  duration_value?: Maybe<Scalars['Int']['output']>;
  expires_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  origin_address_formatted?: Maybe<Scalars['String']['output']>;
  origin_address_id?: Maybe<Scalars['uuid']['output']>;
  status?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "google_distance_cache" */
export type Google_Distance_Cache_Mutation_Response = {
  __typename?: 'google_distance_cache_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Google_Distance_Cache>;
};

/** on_conflict condition type for table "google_distance_cache" */
export type Google_Distance_Cache_On_Conflict = {
  constraint: Google_Distance_Cache_Constraint;
  update_columns?: Array<Google_Distance_Cache_Update_Column>;
  where?: InputMaybe<Google_Distance_Cache_Bool_Exp>;
};

/** Ordering options when selecting data from "google_distance_cache". */
export type Google_Distance_Cache_Order_By = {
  created_at?: InputMaybe<Order_By>;
  destination_address_formatted?: InputMaybe<Order_By>;
  destination_address_id?: InputMaybe<Order_By>;
  distance_text?: InputMaybe<Order_By>;
  distance_value?: InputMaybe<Order_By>;
  duration_text?: InputMaybe<Order_By>;
  duration_value?: InputMaybe<Order_By>;
  expires_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  origin_address_formatted?: InputMaybe<Order_By>;
  origin_address_id?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
};

/** primary key columns input for table: google_distance_cache */
export type Google_Distance_Cache_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "google_distance_cache" */
export enum Google_Distance_Cache_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  DestinationAddressFormatted = 'destination_address_formatted',
  /** column name */
  DestinationAddressId = 'destination_address_id',
  /** column name */
  DistanceText = 'distance_text',
  /** column name */
  DistanceValue = 'distance_value',
  /** column name */
  DurationText = 'duration_text',
  /** column name */
  DurationValue = 'duration_value',
  /** column name */
  ExpiresAt = 'expires_at',
  /** column name */
  Id = 'id',
  /** column name */
  OriginAddressFormatted = 'origin_address_formatted',
  /** column name */
  OriginAddressId = 'origin_address_id',
  /** column name */
  Status = 'status'
}

/** input type for updating data in table "google_distance_cache" */
export type Google_Distance_Cache_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  destination_address_formatted?: InputMaybe<Scalars['String']['input']>;
  destination_address_id?: InputMaybe<Scalars['uuid']['input']>;
  distance_text?: InputMaybe<Scalars['String']['input']>;
  distance_value?: InputMaybe<Scalars['Int']['input']>;
  duration_text?: InputMaybe<Scalars['String']['input']>;
  duration_value?: InputMaybe<Scalars['Int']['input']>;
  expires_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  origin_address_formatted?: InputMaybe<Scalars['String']['input']>;
  origin_address_id?: InputMaybe<Scalars['uuid']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Google_Distance_Cache_Stddev_Fields = {
  __typename?: 'google_distance_cache_stddev_fields';
  distance_value?: Maybe<Scalars['Float']['output']>;
  duration_value?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Google_Distance_Cache_Stddev_Pop_Fields = {
  __typename?: 'google_distance_cache_stddev_pop_fields';
  distance_value?: Maybe<Scalars['Float']['output']>;
  duration_value?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Google_Distance_Cache_Stddev_Samp_Fields = {
  __typename?: 'google_distance_cache_stddev_samp_fields';
  distance_value?: Maybe<Scalars['Float']['output']>;
  duration_value?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "google_distance_cache" */
export type Google_Distance_Cache_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Google_Distance_Cache_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Google_Distance_Cache_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  destination_address_formatted?: InputMaybe<Scalars['String']['input']>;
  destination_address_id?: InputMaybe<Scalars['uuid']['input']>;
  distance_text?: InputMaybe<Scalars['String']['input']>;
  distance_value?: InputMaybe<Scalars['Int']['input']>;
  duration_text?: InputMaybe<Scalars['String']['input']>;
  duration_value?: InputMaybe<Scalars['Int']['input']>;
  expires_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  origin_address_formatted?: InputMaybe<Scalars['String']['input']>;
  origin_address_id?: InputMaybe<Scalars['uuid']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate sum on columns */
export type Google_Distance_Cache_Sum_Fields = {
  __typename?: 'google_distance_cache_sum_fields';
  distance_value?: Maybe<Scalars['Int']['output']>;
  duration_value?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "google_distance_cache" */
export enum Google_Distance_Cache_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  DestinationAddressFormatted = 'destination_address_formatted',
  /** column name */
  DestinationAddressId = 'destination_address_id',
  /** column name */
  DistanceText = 'distance_text',
  /** column name */
  DistanceValue = 'distance_value',
  /** column name */
  DurationText = 'duration_text',
  /** column name */
  DurationValue = 'duration_value',
  /** column name */
  ExpiresAt = 'expires_at',
  /** column name */
  Id = 'id',
  /** column name */
  OriginAddressFormatted = 'origin_address_formatted',
  /** column name */
  OriginAddressId = 'origin_address_id',
  /** column name */
  Status = 'status'
}

export type Google_Distance_Cache_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Google_Distance_Cache_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Google_Distance_Cache_Set_Input>;
  /** filter the rows which have to be updated */
  where: Google_Distance_Cache_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Google_Distance_Cache_Var_Pop_Fields = {
  __typename?: 'google_distance_cache_var_pop_fields';
  distance_value?: Maybe<Scalars['Float']['output']>;
  duration_value?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Google_Distance_Cache_Var_Samp_Fields = {
  __typename?: 'google_distance_cache_var_samp_fields';
  distance_value?: Maybe<Scalars['Float']['output']>;
  duration_value?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Google_Distance_Cache_Variance_Fields = {
  __typename?: 'google_distance_cache_variance_fields';
  distance_value?: Maybe<Scalars['Float']['output']>;
  duration_value?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "google_geocode_cache" */
export type Google_Geocode_Cache = {
  __typename?: 'google_geocode_cache';
  created_at: Scalars['timestamptz']['output'];
  expires_at: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  latitude: Scalars['numeric']['output'];
  longitude: Scalars['numeric']['output'];
  response_data: Scalars['jsonb']['output'];
};


/** columns and relationships of "google_geocode_cache" */
export type Google_Geocode_CacheResponse_DataArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "google_geocode_cache" */
export type Google_Geocode_Cache_Aggregate = {
  __typename?: 'google_geocode_cache_aggregate';
  aggregate?: Maybe<Google_Geocode_Cache_Aggregate_Fields>;
  nodes: Array<Google_Geocode_Cache>;
};

/** aggregate fields of "google_geocode_cache" */
export type Google_Geocode_Cache_Aggregate_Fields = {
  __typename?: 'google_geocode_cache_aggregate_fields';
  avg?: Maybe<Google_Geocode_Cache_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Google_Geocode_Cache_Max_Fields>;
  min?: Maybe<Google_Geocode_Cache_Min_Fields>;
  stddev?: Maybe<Google_Geocode_Cache_Stddev_Fields>;
  stddev_pop?: Maybe<Google_Geocode_Cache_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Google_Geocode_Cache_Stddev_Samp_Fields>;
  sum?: Maybe<Google_Geocode_Cache_Sum_Fields>;
  var_pop?: Maybe<Google_Geocode_Cache_Var_Pop_Fields>;
  var_samp?: Maybe<Google_Geocode_Cache_Var_Samp_Fields>;
  variance?: Maybe<Google_Geocode_Cache_Variance_Fields>;
};


/** aggregate fields of "google_geocode_cache" */
export type Google_Geocode_Cache_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Google_Geocode_Cache_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Google_Geocode_Cache_Append_Input = {
  response_data?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate avg on columns */
export type Google_Geocode_Cache_Avg_Fields = {
  __typename?: 'google_geocode_cache_avg_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "google_geocode_cache". All fields are combined with a logical 'AND'. */
export type Google_Geocode_Cache_Bool_Exp = {
  _and?: InputMaybe<Array<Google_Geocode_Cache_Bool_Exp>>;
  _not?: InputMaybe<Google_Geocode_Cache_Bool_Exp>;
  _or?: InputMaybe<Array<Google_Geocode_Cache_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  expires_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  latitude?: InputMaybe<Numeric_Comparison_Exp>;
  longitude?: InputMaybe<Numeric_Comparison_Exp>;
  response_data?: InputMaybe<Jsonb_Comparison_Exp>;
};

/** unique or primary key constraints on table "google_geocode_cache" */
export enum Google_Geocode_Cache_Constraint {
  /** unique or primary key constraint on columns "latitude", "longitude" */
  GoogleGeocodeCacheLatitudeLongitudeKey = 'google_geocode_cache_latitude_longitude_key',
  /** unique or primary key constraint on columns "id" */
  GoogleGeocodeCachePkey = 'google_geocode_cache_pkey'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Google_Geocode_Cache_Delete_At_Path_Input = {
  response_data?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Google_Geocode_Cache_Delete_Elem_Input = {
  response_data?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Google_Geocode_Cache_Delete_Key_Input = {
  response_data?: InputMaybe<Scalars['String']['input']>;
};

/** input type for incrementing numeric columns in table "google_geocode_cache" */
export type Google_Geocode_Cache_Inc_Input = {
  latitude?: InputMaybe<Scalars['numeric']['input']>;
  longitude?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "google_geocode_cache" */
export type Google_Geocode_Cache_Insert_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  expires_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  latitude?: InputMaybe<Scalars['numeric']['input']>;
  longitude?: InputMaybe<Scalars['numeric']['input']>;
  response_data?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate max on columns */
export type Google_Geocode_Cache_Max_Fields = {
  __typename?: 'google_geocode_cache_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  expires_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  latitude?: Maybe<Scalars['numeric']['output']>;
  longitude?: Maybe<Scalars['numeric']['output']>;
};

/** aggregate min on columns */
export type Google_Geocode_Cache_Min_Fields = {
  __typename?: 'google_geocode_cache_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  expires_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  latitude?: Maybe<Scalars['numeric']['output']>;
  longitude?: Maybe<Scalars['numeric']['output']>;
};

/** response of any mutation on the table "google_geocode_cache" */
export type Google_Geocode_Cache_Mutation_Response = {
  __typename?: 'google_geocode_cache_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Google_Geocode_Cache>;
};

/** on_conflict condition type for table "google_geocode_cache" */
export type Google_Geocode_Cache_On_Conflict = {
  constraint: Google_Geocode_Cache_Constraint;
  update_columns?: Array<Google_Geocode_Cache_Update_Column>;
  where?: InputMaybe<Google_Geocode_Cache_Bool_Exp>;
};

/** Ordering options when selecting data from "google_geocode_cache". */
export type Google_Geocode_Cache_Order_By = {
  created_at?: InputMaybe<Order_By>;
  expires_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  latitude?: InputMaybe<Order_By>;
  longitude?: InputMaybe<Order_By>;
  response_data?: InputMaybe<Order_By>;
};

/** primary key columns input for table: google_geocode_cache */
export type Google_Geocode_Cache_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Google_Geocode_Cache_Prepend_Input = {
  response_data?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "google_geocode_cache" */
export enum Google_Geocode_Cache_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  ExpiresAt = 'expires_at',
  /** column name */
  Id = 'id',
  /** column name */
  Latitude = 'latitude',
  /** column name */
  Longitude = 'longitude',
  /** column name */
  ResponseData = 'response_data'
}

/** input type for updating data in table "google_geocode_cache" */
export type Google_Geocode_Cache_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  expires_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  latitude?: InputMaybe<Scalars['numeric']['input']>;
  longitude?: InputMaybe<Scalars['numeric']['input']>;
  response_data?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate stddev on columns */
export type Google_Geocode_Cache_Stddev_Fields = {
  __typename?: 'google_geocode_cache_stddev_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Google_Geocode_Cache_Stddev_Pop_Fields = {
  __typename?: 'google_geocode_cache_stddev_pop_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Google_Geocode_Cache_Stddev_Samp_Fields = {
  __typename?: 'google_geocode_cache_stddev_samp_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "google_geocode_cache" */
export type Google_Geocode_Cache_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Google_Geocode_Cache_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Google_Geocode_Cache_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  expires_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  latitude?: InputMaybe<Scalars['numeric']['input']>;
  longitude?: InputMaybe<Scalars['numeric']['input']>;
  response_data?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate sum on columns */
export type Google_Geocode_Cache_Sum_Fields = {
  __typename?: 'google_geocode_cache_sum_fields';
  latitude?: Maybe<Scalars['numeric']['output']>;
  longitude?: Maybe<Scalars['numeric']['output']>;
};

/** update columns of table "google_geocode_cache" */
export enum Google_Geocode_Cache_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  ExpiresAt = 'expires_at',
  /** column name */
  Id = 'id',
  /** column name */
  Latitude = 'latitude',
  /** column name */
  Longitude = 'longitude',
  /** column name */
  ResponseData = 'response_data'
}

export type Google_Geocode_Cache_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Google_Geocode_Cache_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Google_Geocode_Cache_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Google_Geocode_Cache_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Google_Geocode_Cache_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Google_Geocode_Cache_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Google_Geocode_Cache_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Google_Geocode_Cache_Set_Input>;
  /** filter the rows which have to be updated */
  where: Google_Geocode_Cache_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Google_Geocode_Cache_Var_Pop_Fields = {
  __typename?: 'google_geocode_cache_var_pop_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Google_Geocode_Cache_Var_Samp_Fields = {
  __typename?: 'google_geocode_cache_var_samp_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Google_Geocode_Cache_Variance_Fields = {
  __typename?: 'google_geocode_cache_variance_fields';
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to compare columns of type "image_type_enum". All fields are combined with logical 'AND'. */
export type Image_Type_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['image_type_enum']['input']>;
  _gt?: InputMaybe<Scalars['image_type_enum']['input']>;
  _gte?: InputMaybe<Scalars['image_type_enum']['input']>;
  _in?: InputMaybe<Array<Scalars['image_type_enum']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['image_type_enum']['input']>;
  _lte?: InputMaybe<Scalars['image_type_enum']['input']>;
  _neq?: InputMaybe<Scalars['image_type_enum']['input']>;
  _nin?: InputMaybe<Array<Scalars['image_type_enum']['input']>>;
};

/** columns and relationships of "item_categories" */
export type Item_Categories = {
  __typename?: 'item_categories';
  created_at: Scalars['timestamptz']['output'];
  description: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  /** An array relationship */
  item_sub_categories: Array<Item_Sub_Categories>;
  /** An aggregate relationship */
  item_sub_categories_aggregate: Item_Sub_Categories_Aggregate;
  name: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updated_at: Scalars['timestamptz']['output'];
};


/** columns and relationships of "item_categories" */
export type Item_CategoriesItem_Sub_CategoriesArgs = {
  distinct_on?: InputMaybe<Array<Item_Sub_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Sub_Categories_Order_By>>;
  where?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
};


/** columns and relationships of "item_categories" */
export type Item_CategoriesItem_Sub_Categories_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Item_Sub_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Sub_Categories_Order_By>>;
  where?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
};

/** aggregated selection of "item_categories" */
export type Item_Categories_Aggregate = {
  __typename?: 'item_categories_aggregate';
  aggregate?: Maybe<Item_Categories_Aggregate_Fields>;
  nodes: Array<Item_Categories>;
};

/** aggregate fields of "item_categories" */
export type Item_Categories_Aggregate_Fields = {
  __typename?: 'item_categories_aggregate_fields';
  avg?: Maybe<Item_Categories_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Item_Categories_Max_Fields>;
  min?: Maybe<Item_Categories_Min_Fields>;
  stddev?: Maybe<Item_Categories_Stddev_Fields>;
  stddev_pop?: Maybe<Item_Categories_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Item_Categories_Stddev_Samp_Fields>;
  sum?: Maybe<Item_Categories_Sum_Fields>;
  var_pop?: Maybe<Item_Categories_Var_Pop_Fields>;
  var_samp?: Maybe<Item_Categories_Var_Samp_Fields>;
  variance?: Maybe<Item_Categories_Variance_Fields>;
};


/** aggregate fields of "item_categories" */
export type Item_Categories_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Item_Categories_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Item_Categories_Avg_Fields = {
  __typename?: 'item_categories_avg_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "item_categories". All fields are combined with a logical 'AND'. */
export type Item_Categories_Bool_Exp = {
  _and?: InputMaybe<Array<Item_Categories_Bool_Exp>>;
  _not?: InputMaybe<Item_Categories_Bool_Exp>;
  _or?: InputMaybe<Array<Item_Categories_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Int_Comparison_Exp>;
  item_sub_categories?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
  item_sub_categories_aggregate?: InputMaybe<Item_Sub_Categories_Aggregate_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "item_categories" */
export enum Item_Categories_Constraint {
  /** unique or primary key constraint on columns "name" */
  ItemCategoriesNameKey = 'item_categories_name_key',
  /** unique or primary key constraint on columns "id" */
  ItemCategoriesPkey = 'item_categories_pkey'
}

/** input type for incrementing numeric columns in table "item_categories" */
export type Item_Categories_Inc_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "item_categories" */
export type Item_Categories_Insert_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  item_sub_categories?: InputMaybe<Item_Sub_Categories_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Item_Categories_Max_Fields = {
  __typename?: 'item_categories_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregate min on columns */
export type Item_Categories_Min_Fields = {
  __typename?: 'item_categories_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** response of any mutation on the table "item_categories" */
export type Item_Categories_Mutation_Response = {
  __typename?: 'item_categories_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Item_Categories>;
};

/** input type for inserting object relation for remote table "item_categories" */
export type Item_Categories_Obj_Rel_Insert_Input = {
  data: Item_Categories_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Item_Categories_On_Conflict>;
};

/** on_conflict condition type for table "item_categories" */
export type Item_Categories_On_Conflict = {
  constraint: Item_Categories_Constraint;
  update_columns?: Array<Item_Categories_Update_Column>;
  where?: InputMaybe<Item_Categories_Bool_Exp>;
};

/** Ordering options when selecting data from "item_categories". */
export type Item_Categories_Order_By = {
  created_at?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_sub_categories_aggregate?: InputMaybe<Item_Sub_Categories_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: item_categories */
export type Item_Categories_Pk_Columns_Input = {
  id: Scalars['Int']['input'];
};

/** select columns of table "item_categories" */
export enum Item_Categories_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Status = 'status',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "item_categories" */
export type Item_Categories_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Item_Categories_Stddev_Fields = {
  __typename?: 'item_categories_stddev_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Item_Categories_Stddev_Pop_Fields = {
  __typename?: 'item_categories_stddev_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Item_Categories_Stddev_Samp_Fields = {
  __typename?: 'item_categories_stddev_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "item_categories" */
export type Item_Categories_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Item_Categories_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Item_Categories_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Item_Categories_Sum_Fields = {
  __typename?: 'item_categories_sum_fields';
  id?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "item_categories" */
export enum Item_Categories_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Status = 'status',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Item_Categories_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Item_Categories_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Item_Categories_Set_Input>;
  /** filter the rows which have to be updated */
  where: Item_Categories_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Item_Categories_Var_Pop_Fields = {
  __typename?: 'item_categories_var_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Item_Categories_Var_Samp_Fields = {
  __typename?: 'item_categories_var_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Item_Categories_Variance_Fields = {
  __typename?: 'item_categories_variance_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** columns and relationships of "item_images" */
export type Item_Images = {
  __typename?: 'item_images';
  alt_text?: Maybe<Scalars['String']['output']>;
  caption?: Maybe<Scalars['String']['output']>;
  created_at: Scalars['timestamptz']['output'];
  display_order?: Maybe<Scalars['Int']['output']>;
  file_size?: Maybe<Scalars['Int']['output']>;
  format?: Maybe<Scalars['String']['output']>;
  height?: Maybe<Scalars['Int']['output']>;
  id: Scalars['uuid']['output'];
  image_type?: Maybe<Scalars['image_type_enum']['output']>;
  image_url: Scalars['String']['output'];
  is_active?: Maybe<Scalars['Boolean']['output']>;
  /** An object relationship */
  item: Items;
  item_id: Scalars['uuid']['output'];
  updated_at: Scalars['timestamptz']['output'];
  uploaded_by?: Maybe<Scalars['uuid']['output']>;
  /** An object relationship */
  uploaded_by_user?: Maybe<Users>;
  width?: Maybe<Scalars['Int']['output']>;
};

/** aggregated selection of "item_images" */
export type Item_Images_Aggregate = {
  __typename?: 'item_images_aggregate';
  aggregate?: Maybe<Item_Images_Aggregate_Fields>;
  nodes: Array<Item_Images>;
};

export type Item_Images_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Item_Images_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Item_Images_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Item_Images_Aggregate_Bool_Exp_Count>;
};

export type Item_Images_Aggregate_Bool_Exp_Bool_And = {
  arguments: Item_Images_Select_Column_Item_Images_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Item_Images_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Item_Images_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Item_Images_Select_Column_Item_Images_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Item_Images_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Item_Images_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Item_Images_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Item_Images_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "item_images" */
export type Item_Images_Aggregate_Fields = {
  __typename?: 'item_images_aggregate_fields';
  avg?: Maybe<Item_Images_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Item_Images_Max_Fields>;
  min?: Maybe<Item_Images_Min_Fields>;
  stddev?: Maybe<Item_Images_Stddev_Fields>;
  stddev_pop?: Maybe<Item_Images_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Item_Images_Stddev_Samp_Fields>;
  sum?: Maybe<Item_Images_Sum_Fields>;
  var_pop?: Maybe<Item_Images_Var_Pop_Fields>;
  var_samp?: Maybe<Item_Images_Var_Samp_Fields>;
  variance?: Maybe<Item_Images_Variance_Fields>;
};


/** aggregate fields of "item_images" */
export type Item_Images_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Item_Images_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "item_images" */
export type Item_Images_Aggregate_Order_By = {
  avg?: InputMaybe<Item_Images_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Item_Images_Max_Order_By>;
  min?: InputMaybe<Item_Images_Min_Order_By>;
  stddev?: InputMaybe<Item_Images_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Item_Images_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Item_Images_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Item_Images_Sum_Order_By>;
  var_pop?: InputMaybe<Item_Images_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Item_Images_Var_Samp_Order_By>;
  variance?: InputMaybe<Item_Images_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "item_images" */
export type Item_Images_Arr_Rel_Insert_Input = {
  data: Array<Item_Images_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Item_Images_On_Conflict>;
};

/** aggregate avg on columns */
export type Item_Images_Avg_Fields = {
  __typename?: 'item_images_avg_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "item_images" */
export type Item_Images_Avg_Order_By = {
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "item_images". All fields are combined with a logical 'AND'. */
export type Item_Images_Bool_Exp = {
  _and?: InputMaybe<Array<Item_Images_Bool_Exp>>;
  _not?: InputMaybe<Item_Images_Bool_Exp>;
  _or?: InputMaybe<Array<Item_Images_Bool_Exp>>;
  alt_text?: InputMaybe<String_Comparison_Exp>;
  caption?: InputMaybe<String_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  display_order?: InputMaybe<Int_Comparison_Exp>;
  file_size?: InputMaybe<Int_Comparison_Exp>;
  format?: InputMaybe<String_Comparison_Exp>;
  height?: InputMaybe<Int_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  image_type?: InputMaybe<Image_Type_Enum_Comparison_Exp>;
  image_url?: InputMaybe<String_Comparison_Exp>;
  is_active?: InputMaybe<Boolean_Comparison_Exp>;
  item?: InputMaybe<Items_Bool_Exp>;
  item_id?: InputMaybe<Uuid_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  uploaded_by?: InputMaybe<Uuid_Comparison_Exp>;
  uploaded_by_user?: InputMaybe<Users_Bool_Exp>;
  width?: InputMaybe<Int_Comparison_Exp>;
};

/** unique or primary key constraints on table "item_images" */
export enum Item_Images_Constraint {
  /** unique or primary key constraint on columns "id" */
  ItemImagesPkey = 'item_images_pkey',
  /** unique or primary key constraint on columns "image_type", "item_id" */
  UniqueItemMainImage = 'unique_item_main_image'
}

/** input type for incrementing numeric columns in table "item_images" */
export type Item_Images_Inc_Input = {
  display_order?: InputMaybe<Scalars['Int']['input']>;
  file_size?: InputMaybe<Scalars['Int']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "item_images" */
export type Item_Images_Insert_Input = {
  alt_text?: InputMaybe<Scalars['String']['input']>;
  caption?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  display_order?: InputMaybe<Scalars['Int']['input']>;
  file_size?: InputMaybe<Scalars['Int']['input']>;
  format?: InputMaybe<Scalars['String']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  image_type?: InputMaybe<Scalars['image_type_enum']['input']>;
  image_url?: InputMaybe<Scalars['String']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  item?: InputMaybe<Items_Obj_Rel_Insert_Input>;
  item_id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  uploaded_by?: InputMaybe<Scalars['uuid']['input']>;
  uploaded_by_user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate max on columns */
export type Item_Images_Max_Fields = {
  __typename?: 'item_images_max_fields';
  alt_text?: Maybe<Scalars['String']['output']>;
  caption?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  display_order?: Maybe<Scalars['Int']['output']>;
  file_size?: Maybe<Scalars['Int']['output']>;
  format?: Maybe<Scalars['String']['output']>;
  height?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  image_type?: Maybe<Scalars['image_type_enum']['output']>;
  image_url?: Maybe<Scalars['String']['output']>;
  item_id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  uploaded_by?: Maybe<Scalars['uuid']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
};

/** order by max() on columns of table "item_images" */
export type Item_Images_Max_Order_By = {
  alt_text?: InputMaybe<Order_By>;
  caption?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  format?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  image_type?: InputMaybe<Order_By>;
  image_url?: InputMaybe<Order_By>;
  item_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  uploaded_by?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Item_Images_Min_Fields = {
  __typename?: 'item_images_min_fields';
  alt_text?: Maybe<Scalars['String']['output']>;
  caption?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  display_order?: Maybe<Scalars['Int']['output']>;
  file_size?: Maybe<Scalars['Int']['output']>;
  format?: Maybe<Scalars['String']['output']>;
  height?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  image_type?: Maybe<Scalars['image_type_enum']['output']>;
  image_url?: Maybe<Scalars['String']['output']>;
  item_id?: Maybe<Scalars['uuid']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  uploaded_by?: Maybe<Scalars['uuid']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
};

/** order by min() on columns of table "item_images" */
export type Item_Images_Min_Order_By = {
  alt_text?: InputMaybe<Order_By>;
  caption?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  format?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  image_type?: InputMaybe<Order_By>;
  image_url?: InputMaybe<Order_By>;
  item_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  uploaded_by?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "item_images" */
export type Item_Images_Mutation_Response = {
  __typename?: 'item_images_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Item_Images>;
};

/** on_conflict condition type for table "item_images" */
export type Item_Images_On_Conflict = {
  constraint: Item_Images_Constraint;
  update_columns?: Array<Item_Images_Update_Column>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};

/** Ordering options when selecting data from "item_images". */
export type Item_Images_Order_By = {
  alt_text?: InputMaybe<Order_By>;
  caption?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  format?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  image_type?: InputMaybe<Order_By>;
  image_url?: InputMaybe<Order_By>;
  is_active?: InputMaybe<Order_By>;
  item?: InputMaybe<Items_Order_By>;
  item_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  uploaded_by?: InputMaybe<Order_By>;
  uploaded_by_user?: InputMaybe<Users_Order_By>;
  width?: InputMaybe<Order_By>;
};

/** primary key columns input for table: item_images */
export type Item_Images_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "item_images" */
export enum Item_Images_Select_Column {
  /** column name */
  AltText = 'alt_text',
  /** column name */
  Caption = 'caption',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  DisplayOrder = 'display_order',
  /** column name */
  FileSize = 'file_size',
  /** column name */
  Format = 'format',
  /** column name */
  Height = 'height',
  /** column name */
  Id = 'id',
  /** column name */
  ImageType = 'image_type',
  /** column name */
  ImageUrl = 'image_url',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  ItemId = 'item_id',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UploadedBy = 'uploaded_by',
  /** column name */
  Width = 'width'
}

/** select "item_images_aggregate_bool_exp_bool_and_arguments_columns" columns of table "item_images" */
export enum Item_Images_Select_Column_Item_Images_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsActive = 'is_active'
}

/** select "item_images_aggregate_bool_exp_bool_or_arguments_columns" columns of table "item_images" */
export enum Item_Images_Select_Column_Item_Images_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsActive = 'is_active'
}

/** input type for updating data in table "item_images" */
export type Item_Images_Set_Input = {
  alt_text?: InputMaybe<Scalars['String']['input']>;
  caption?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  display_order?: InputMaybe<Scalars['Int']['input']>;
  file_size?: InputMaybe<Scalars['Int']['input']>;
  format?: InputMaybe<Scalars['String']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  image_type?: InputMaybe<Scalars['image_type_enum']['input']>;
  image_url?: InputMaybe<Scalars['String']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  item_id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  uploaded_by?: InputMaybe<Scalars['uuid']['input']>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate stddev on columns */
export type Item_Images_Stddev_Fields = {
  __typename?: 'item_images_stddev_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "item_images" */
export type Item_Images_Stddev_Order_By = {
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Item_Images_Stddev_Pop_Fields = {
  __typename?: 'item_images_stddev_pop_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "item_images" */
export type Item_Images_Stddev_Pop_Order_By = {
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Item_Images_Stddev_Samp_Fields = {
  __typename?: 'item_images_stddev_samp_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "item_images" */
export type Item_Images_Stddev_Samp_Order_By = {
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "item_images" */
export type Item_Images_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Item_Images_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Item_Images_Stream_Cursor_Value_Input = {
  alt_text?: InputMaybe<Scalars['String']['input']>;
  caption?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  display_order?: InputMaybe<Scalars['Int']['input']>;
  file_size?: InputMaybe<Scalars['Int']['input']>;
  format?: InputMaybe<Scalars['String']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  image_type?: InputMaybe<Scalars['image_type_enum']['input']>;
  image_url?: InputMaybe<Scalars['String']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  item_id?: InputMaybe<Scalars['uuid']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  uploaded_by?: InputMaybe<Scalars['uuid']['input']>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate sum on columns */
export type Item_Images_Sum_Fields = {
  __typename?: 'item_images_sum_fields';
  display_order?: Maybe<Scalars['Int']['output']>;
  file_size?: Maybe<Scalars['Int']['output']>;
  height?: Maybe<Scalars['Int']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "item_images" */
export type Item_Images_Sum_Order_By = {
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** update columns of table "item_images" */
export enum Item_Images_Update_Column {
  /** column name */
  AltText = 'alt_text',
  /** column name */
  Caption = 'caption',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  DisplayOrder = 'display_order',
  /** column name */
  FileSize = 'file_size',
  /** column name */
  Format = 'format',
  /** column name */
  Height = 'height',
  /** column name */
  Id = 'id',
  /** column name */
  ImageType = 'image_type',
  /** column name */
  ImageUrl = 'image_url',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  ItemId = 'item_id',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UploadedBy = 'uploaded_by',
  /** column name */
  Width = 'width'
}

export type Item_Images_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Item_Images_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Item_Images_Set_Input>;
  /** filter the rows which have to be updated */
  where: Item_Images_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Item_Images_Var_Pop_Fields = {
  __typename?: 'item_images_var_pop_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "item_images" */
export type Item_Images_Var_Pop_Order_By = {
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Item_Images_Var_Samp_Fields = {
  __typename?: 'item_images_var_samp_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "item_images" */
export type Item_Images_Var_Samp_Order_By = {
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Item_Images_Variance_Fields = {
  __typename?: 'item_images_variance_fields';
  display_order?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
  height?: Maybe<Scalars['Float']['output']>;
  width?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "item_images" */
export type Item_Images_Variance_Order_By = {
  display_order?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  height?: InputMaybe<Order_By>;
  width?: InputMaybe<Order_By>;
};

/** columns and relationships of "item_sub_categories" */
export type Item_Sub_Categories = {
  __typename?: 'item_sub_categories';
  created_at: Scalars['timestamptz']['output'];
  description: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  /** An object relationship */
  item_category: Item_Categories;
  item_category_id: Scalars['Int']['output'];
  /** An array relationship */
  items: Array<Items>;
  /** An aggregate relationship */
  items_aggregate: Items_Aggregate;
  name: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updated_at: Scalars['timestamptz']['output'];
};


/** columns and relationships of "item_sub_categories" */
export type Item_Sub_CategoriesItemsArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};


/** columns and relationships of "item_sub_categories" */
export type Item_Sub_CategoriesItems_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};

/** aggregated selection of "item_sub_categories" */
export type Item_Sub_Categories_Aggregate = {
  __typename?: 'item_sub_categories_aggregate';
  aggregate?: Maybe<Item_Sub_Categories_Aggregate_Fields>;
  nodes: Array<Item_Sub_Categories>;
};

export type Item_Sub_Categories_Aggregate_Bool_Exp = {
  count?: InputMaybe<Item_Sub_Categories_Aggregate_Bool_Exp_Count>;
};

export type Item_Sub_Categories_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Item_Sub_Categories_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "item_sub_categories" */
export type Item_Sub_Categories_Aggregate_Fields = {
  __typename?: 'item_sub_categories_aggregate_fields';
  avg?: Maybe<Item_Sub_Categories_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Item_Sub_Categories_Max_Fields>;
  min?: Maybe<Item_Sub_Categories_Min_Fields>;
  stddev?: Maybe<Item_Sub_Categories_Stddev_Fields>;
  stddev_pop?: Maybe<Item_Sub_Categories_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Item_Sub_Categories_Stddev_Samp_Fields>;
  sum?: Maybe<Item_Sub_Categories_Sum_Fields>;
  var_pop?: Maybe<Item_Sub_Categories_Var_Pop_Fields>;
  var_samp?: Maybe<Item_Sub_Categories_Var_Samp_Fields>;
  variance?: Maybe<Item_Sub_Categories_Variance_Fields>;
};


/** aggregate fields of "item_sub_categories" */
export type Item_Sub_Categories_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Item_Sub_Categories_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "item_sub_categories" */
export type Item_Sub_Categories_Aggregate_Order_By = {
  avg?: InputMaybe<Item_Sub_Categories_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Item_Sub_Categories_Max_Order_By>;
  min?: InputMaybe<Item_Sub_Categories_Min_Order_By>;
  stddev?: InputMaybe<Item_Sub_Categories_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Item_Sub_Categories_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Item_Sub_Categories_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Item_Sub_Categories_Sum_Order_By>;
  var_pop?: InputMaybe<Item_Sub_Categories_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Item_Sub_Categories_Var_Samp_Order_By>;
  variance?: InputMaybe<Item_Sub_Categories_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "item_sub_categories" */
export type Item_Sub_Categories_Arr_Rel_Insert_Input = {
  data: Array<Item_Sub_Categories_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Item_Sub_Categories_On_Conflict>;
};

/** aggregate avg on columns */
export type Item_Sub_Categories_Avg_Fields = {
  __typename?: 'item_sub_categories_avg_fields';
  id?: Maybe<Scalars['Float']['output']>;
  item_category_id?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Avg_Order_By = {
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "item_sub_categories". All fields are combined with a logical 'AND'. */
export type Item_Sub_Categories_Bool_Exp = {
  _and?: InputMaybe<Array<Item_Sub_Categories_Bool_Exp>>;
  _not?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
  _or?: InputMaybe<Array<Item_Sub_Categories_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Int_Comparison_Exp>;
  item_category?: InputMaybe<Item_Categories_Bool_Exp>;
  item_category_id?: InputMaybe<Int_Comparison_Exp>;
  items?: InputMaybe<Items_Bool_Exp>;
  items_aggregate?: InputMaybe<Items_Aggregate_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "item_sub_categories" */
export enum Item_Sub_Categories_Constraint {
  /** unique or primary key constraint on columns "id" */
  ItemSubCategoriesPkey = 'item_sub_categories_pkey'
}

/** input type for incrementing numeric columns in table "item_sub_categories" */
export type Item_Sub_Categories_Inc_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
  item_category_id?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "item_sub_categories" */
export type Item_Sub_Categories_Insert_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  item_category?: InputMaybe<Item_Categories_Obj_Rel_Insert_Input>;
  item_category_id?: InputMaybe<Scalars['Int']['input']>;
  items?: InputMaybe<Items_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Item_Sub_Categories_Max_Fields = {
  __typename?: 'item_sub_categories_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  item_category_id?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Max_Order_By = {
  created_at?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Item_Sub_Categories_Min_Fields = {
  __typename?: 'item_sub_categories_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  item_category_id?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Min_Order_By = {
  created_at?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "item_sub_categories" */
export type Item_Sub_Categories_Mutation_Response = {
  __typename?: 'item_sub_categories_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Item_Sub_Categories>;
};

/** input type for inserting object relation for remote table "item_sub_categories" */
export type Item_Sub_Categories_Obj_Rel_Insert_Input = {
  data: Item_Sub_Categories_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Item_Sub_Categories_On_Conflict>;
};

/** on_conflict condition type for table "item_sub_categories" */
export type Item_Sub_Categories_On_Conflict = {
  constraint: Item_Sub_Categories_Constraint;
  update_columns?: Array<Item_Sub_Categories_Update_Column>;
  where?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
};

/** Ordering options when selecting data from "item_sub_categories". */
export type Item_Sub_Categories_Order_By = {
  created_at?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_category?: InputMaybe<Item_Categories_Order_By>;
  item_category_id?: InputMaybe<Order_By>;
  items_aggregate?: InputMaybe<Items_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: item_sub_categories */
export type Item_Sub_Categories_Pk_Columns_Input = {
  id: Scalars['Int']['input'];
};

/** select columns of table "item_sub_categories" */
export enum Item_Sub_Categories_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  ItemCategoryId = 'item_category_id',
  /** column name */
  Name = 'name',
  /** column name */
  Status = 'status',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "item_sub_categories" */
export type Item_Sub_Categories_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  item_category_id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Item_Sub_Categories_Stddev_Fields = {
  __typename?: 'item_sub_categories_stddev_fields';
  id?: Maybe<Scalars['Float']['output']>;
  item_category_id?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Stddev_Order_By = {
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Item_Sub_Categories_Stddev_Pop_Fields = {
  __typename?: 'item_sub_categories_stddev_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
  item_category_id?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Stddev_Pop_Order_By = {
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Item_Sub_Categories_Stddev_Samp_Fields = {
  __typename?: 'item_sub_categories_stddev_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
  item_category_id?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Stddev_Samp_Order_By = {
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "item_sub_categories" */
export type Item_Sub_Categories_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Item_Sub_Categories_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Item_Sub_Categories_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  item_category_id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Item_Sub_Categories_Sum_Fields = {
  __typename?: 'item_sub_categories_sum_fields';
  id?: Maybe<Scalars['Int']['output']>;
  item_category_id?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Sum_Order_By = {
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
};

/** update columns of table "item_sub_categories" */
export enum Item_Sub_Categories_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  ItemCategoryId = 'item_category_id',
  /** column name */
  Name = 'name',
  /** column name */
  Status = 'status',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Item_Sub_Categories_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Item_Sub_Categories_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Item_Sub_Categories_Set_Input>;
  /** filter the rows which have to be updated */
  where: Item_Sub_Categories_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Item_Sub_Categories_Var_Pop_Fields = {
  __typename?: 'item_sub_categories_var_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
  item_category_id?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Var_Pop_Order_By = {
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Item_Sub_Categories_Var_Samp_Fields = {
  __typename?: 'item_sub_categories_var_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
  item_category_id?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Var_Samp_Order_By = {
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Item_Sub_Categories_Variance_Fields = {
  __typename?: 'item_sub_categories_variance_fields';
  id?: Maybe<Scalars['Float']['output']>;
  item_category_id?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "item_sub_categories" */
export type Item_Sub_Categories_Variance_Order_By = {
  id?: InputMaybe<Order_By>;
  item_category_id?: InputMaybe<Order_By>;
};

/** columns and relationships of "items" */
export type Items = {
  __typename?: 'items';
  /** An object relationship */
  brand?: Maybe<Brands>;
  brand_id?: Maybe<Scalars['uuid']['output']>;
  /** An object relationship */
  business?: Maybe<Businesses>;
  business_id?: Maybe<Scalars['uuid']['output']>;
  /** An array relationship */
  business_inventories: Array<Business_Inventory>;
  /** An aggregate relationship */
  business_inventories_aggregate: Business_Inventory_Aggregate;
  color?: Maybe<Scalars['String']['output']>;
  created_at: Scalars['timestamptz']['output'];
  currency: Scalars['String']['output'];
  description: Scalars['String']['output'];
  estimated_delivery_time?: Maybe<Scalars['Int']['output']>;
  id: Scalars['uuid']['output'];
  is_active?: Maybe<Scalars['Boolean']['output']>;
  is_fragile?: Maybe<Scalars['Boolean']['output']>;
  is_perishable?: Maybe<Scalars['Boolean']['output']>;
  /** An array relationship */
  item_images: Array<Item_Images>;
  /** An aggregate relationship */
  item_images_aggregate: Item_Images_Aggregate;
  /** An object relationship */
  item_sub_category: Item_Sub_Categories;
  item_sub_category_id: Scalars['Int']['output'];
  max_delivery_distance?: Maybe<Scalars['Int']['output']>;
  max_order_quantity?: Maybe<Scalars['Int']['output']>;
  min_order_quantity?: Maybe<Scalars['Int']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  /** An array relationship */
  order_items: Array<Order_Items>;
  /** An aggregate relationship */
  order_items_aggregate: Order_Items_Aggregate;
  price: Scalars['numeric']['output'];
  /** An array relationship */
  ratings_received: Array<Ratings>;
  /** An aggregate relationship */
  ratings_received_aggregate: Ratings_Aggregate;
  requires_special_handling?: Maybe<Scalars['Boolean']['output']>;
  sku?: Maybe<Scalars['String']['output']>;
  updated_at: Scalars['timestamptz']['output'];
  weight?: Maybe<Scalars['numeric']['output']>;
  weight_unit?: Maybe<Scalars['weight_units_enum']['output']>;
};


/** columns and relationships of "items" */
export type ItemsBusiness_InventoriesArgs = {
  distinct_on?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Inventory_Order_By>>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};


/** columns and relationships of "items" */
export type ItemsBusiness_Inventories_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Inventory_Order_By>>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};


/** columns and relationships of "items" */
export type ItemsItem_ImagesArgs = {
  distinct_on?: InputMaybe<Array<Item_Images_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Images_Order_By>>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};


/** columns and relationships of "items" */
export type ItemsItem_Images_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Item_Images_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Images_Order_By>>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};


/** columns and relationships of "items" */
export type ItemsOrder_ItemsArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


/** columns and relationships of "items" */
export type ItemsOrder_Items_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


/** columns and relationships of "items" */
export type ItemsRatings_ReceivedArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


/** columns and relationships of "items" */
export type ItemsRatings_Received_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};

/** aggregated selection of "items" */
export type Items_Aggregate = {
  __typename?: 'items_aggregate';
  aggregate?: Maybe<Items_Aggregate_Fields>;
  nodes: Array<Items>;
};

export type Items_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Items_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Items_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Items_Aggregate_Bool_Exp_Count>;
};

export type Items_Aggregate_Bool_Exp_Bool_And = {
  arguments: Items_Select_Column_Items_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Items_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Items_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Items_Select_Column_Items_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Items_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Items_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Items_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Items_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "items" */
export type Items_Aggregate_Fields = {
  __typename?: 'items_aggregate_fields';
  avg?: Maybe<Items_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Items_Max_Fields>;
  min?: Maybe<Items_Min_Fields>;
  stddev?: Maybe<Items_Stddev_Fields>;
  stddev_pop?: Maybe<Items_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Items_Stddev_Samp_Fields>;
  sum?: Maybe<Items_Sum_Fields>;
  var_pop?: Maybe<Items_Var_Pop_Fields>;
  var_samp?: Maybe<Items_Var_Samp_Fields>;
  variance?: Maybe<Items_Variance_Fields>;
};


/** aggregate fields of "items" */
export type Items_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Items_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "items" */
export type Items_Aggregate_Order_By = {
  avg?: InputMaybe<Items_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Items_Max_Order_By>;
  min?: InputMaybe<Items_Min_Order_By>;
  stddev?: InputMaybe<Items_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Items_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Items_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Items_Sum_Order_By>;
  var_pop?: InputMaybe<Items_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Items_Var_Samp_Order_By>;
  variance?: InputMaybe<Items_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "items" */
export type Items_Arr_Rel_Insert_Input = {
  data: Array<Items_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Items_On_Conflict>;
};

/** aggregate avg on columns */
export type Items_Avg_Fields = {
  __typename?: 'items_avg_fields';
  estimated_delivery_time?: Maybe<Scalars['Float']['output']>;
  item_sub_category_id?: Maybe<Scalars['Float']['output']>;
  max_delivery_distance?: Maybe<Scalars['Float']['output']>;
  max_order_quantity?: Maybe<Scalars['Float']['output']>;
  min_order_quantity?: Maybe<Scalars['Float']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "items" */
export type Items_Avg_Order_By = {
  estimated_delivery_time?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "items". All fields are combined with a logical 'AND'. */
export type Items_Bool_Exp = {
  _and?: InputMaybe<Array<Items_Bool_Exp>>;
  _not?: InputMaybe<Items_Bool_Exp>;
  _or?: InputMaybe<Array<Items_Bool_Exp>>;
  brand?: InputMaybe<Brands_Bool_Exp>;
  brand_id?: InputMaybe<Uuid_Comparison_Exp>;
  business?: InputMaybe<Businesses_Bool_Exp>;
  business_id?: InputMaybe<Uuid_Comparison_Exp>;
  business_inventories?: InputMaybe<Business_Inventory_Bool_Exp>;
  business_inventories_aggregate?: InputMaybe<Business_Inventory_Aggregate_Bool_Exp>;
  color?: InputMaybe<String_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<String_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  estimated_delivery_time?: InputMaybe<Int_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_active?: InputMaybe<Boolean_Comparison_Exp>;
  is_fragile?: InputMaybe<Boolean_Comparison_Exp>;
  is_perishable?: InputMaybe<Boolean_Comparison_Exp>;
  item_images?: InputMaybe<Item_Images_Bool_Exp>;
  item_images_aggregate?: InputMaybe<Item_Images_Aggregate_Bool_Exp>;
  item_sub_category?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
  item_sub_category_id?: InputMaybe<Int_Comparison_Exp>;
  max_delivery_distance?: InputMaybe<Int_Comparison_Exp>;
  max_order_quantity?: InputMaybe<Int_Comparison_Exp>;
  min_order_quantity?: InputMaybe<Int_Comparison_Exp>;
  model?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  order_items?: InputMaybe<Order_Items_Bool_Exp>;
  order_items_aggregate?: InputMaybe<Order_Items_Aggregate_Bool_Exp>;
  price?: InputMaybe<Numeric_Comparison_Exp>;
  ratings_received?: InputMaybe<Ratings_Bool_Exp>;
  ratings_received_aggregate?: InputMaybe<Ratings_Aggregate_Bool_Exp>;
  requires_special_handling?: InputMaybe<Boolean_Comparison_Exp>;
  sku?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  weight?: InputMaybe<Numeric_Comparison_Exp>;
  weight_unit?: InputMaybe<Weight_Units_Enum_Comparison_Exp>;
};

/** unique or primary key constraints on table "items" */
export enum Items_Constraint {
  /** unique or primary key constraint on columns "id" */
  ItemsPkey = 'items_pkey',
  /** unique or primary key constraint on columns "sku" */
  ItemsSkuKey = 'items_sku_key'
}

/** input type for incrementing numeric columns in table "items" */
export type Items_Inc_Input = {
  estimated_delivery_time?: InputMaybe<Scalars['Int']['input']>;
  item_sub_category_id?: InputMaybe<Scalars['Int']['input']>;
  max_delivery_distance?: InputMaybe<Scalars['Int']['input']>;
  max_order_quantity?: InputMaybe<Scalars['Int']['input']>;
  min_order_quantity?: InputMaybe<Scalars['Int']['input']>;
  price?: InputMaybe<Scalars['numeric']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "items" */
export type Items_Insert_Input = {
  brand?: InputMaybe<Brands_Obj_Rel_Insert_Input>;
  brand_id?: InputMaybe<Scalars['uuid']['input']>;
  business?: InputMaybe<Businesses_Obj_Rel_Insert_Input>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  business_inventories?: InputMaybe<Business_Inventory_Arr_Rel_Insert_Input>;
  color?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  estimated_delivery_time?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  is_fragile?: InputMaybe<Scalars['Boolean']['input']>;
  is_perishable?: InputMaybe<Scalars['Boolean']['input']>;
  item_images?: InputMaybe<Item_Images_Arr_Rel_Insert_Input>;
  item_sub_category?: InputMaybe<Item_Sub_Categories_Obj_Rel_Insert_Input>;
  item_sub_category_id?: InputMaybe<Scalars['Int']['input']>;
  max_delivery_distance?: InputMaybe<Scalars['Int']['input']>;
  max_order_quantity?: InputMaybe<Scalars['Int']['input']>;
  min_order_quantity?: InputMaybe<Scalars['Int']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  order_items?: InputMaybe<Order_Items_Arr_Rel_Insert_Input>;
  price?: InputMaybe<Scalars['numeric']['input']>;
  ratings_received?: InputMaybe<Ratings_Arr_Rel_Insert_Input>;
  requires_special_handling?: InputMaybe<Scalars['Boolean']['input']>;
  sku?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  weight_unit?: InputMaybe<Scalars['weight_units_enum']['input']>;
};

/** aggregate max on columns */
export type Items_Max_Fields = {
  __typename?: 'items_max_fields';
  brand_id?: Maybe<Scalars['uuid']['output']>;
  business_id?: Maybe<Scalars['uuid']['output']>;
  color?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  estimated_delivery_time?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  item_sub_category_id?: Maybe<Scalars['Int']['output']>;
  max_delivery_distance?: Maybe<Scalars['Int']['output']>;
  max_order_quantity?: Maybe<Scalars['Int']['output']>;
  min_order_quantity?: Maybe<Scalars['Int']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  price?: Maybe<Scalars['numeric']['output']>;
  sku?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
  weight_unit?: Maybe<Scalars['weight_units_enum']['output']>;
};

/** order by max() on columns of table "items" */
export type Items_Max_Order_By = {
  brand_id?: InputMaybe<Order_By>;
  business_id?: InputMaybe<Order_By>;
  color?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  estimated_delivery_time?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  model?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  sku?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  weight_unit?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Items_Min_Fields = {
  __typename?: 'items_min_fields';
  brand_id?: Maybe<Scalars['uuid']['output']>;
  business_id?: Maybe<Scalars['uuid']['output']>;
  color?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  estimated_delivery_time?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  item_sub_category_id?: Maybe<Scalars['Int']['output']>;
  max_delivery_distance?: Maybe<Scalars['Int']['output']>;
  max_order_quantity?: Maybe<Scalars['Int']['output']>;
  min_order_quantity?: Maybe<Scalars['Int']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  price?: Maybe<Scalars['numeric']['output']>;
  sku?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
  weight_unit?: Maybe<Scalars['weight_units_enum']['output']>;
};

/** order by min() on columns of table "items" */
export type Items_Min_Order_By = {
  brand_id?: InputMaybe<Order_By>;
  business_id?: InputMaybe<Order_By>;
  color?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  estimated_delivery_time?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  model?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  sku?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  weight_unit?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "items" */
export type Items_Mutation_Response = {
  __typename?: 'items_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Items>;
};

/** input type for inserting object relation for remote table "items" */
export type Items_Obj_Rel_Insert_Input = {
  data: Items_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Items_On_Conflict>;
};

/** on_conflict condition type for table "items" */
export type Items_On_Conflict = {
  constraint: Items_Constraint;
  update_columns?: Array<Items_Update_Column>;
  where?: InputMaybe<Items_Bool_Exp>;
};

/** Ordering options when selecting data from "items". */
export type Items_Order_By = {
  brand?: InputMaybe<Brands_Order_By>;
  brand_id?: InputMaybe<Order_By>;
  business?: InputMaybe<Businesses_Order_By>;
  business_id?: InputMaybe<Order_By>;
  business_inventories_aggregate?: InputMaybe<Business_Inventory_Aggregate_Order_By>;
  color?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  estimated_delivery_time?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_active?: InputMaybe<Order_By>;
  is_fragile?: InputMaybe<Order_By>;
  is_perishable?: InputMaybe<Order_By>;
  item_images_aggregate?: InputMaybe<Item_Images_Aggregate_Order_By>;
  item_sub_category?: InputMaybe<Item_Sub_Categories_Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  model?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  order_items_aggregate?: InputMaybe<Order_Items_Aggregate_Order_By>;
  price?: InputMaybe<Order_By>;
  ratings_received_aggregate?: InputMaybe<Ratings_Aggregate_Order_By>;
  requires_special_handling?: InputMaybe<Order_By>;
  sku?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  weight_unit?: InputMaybe<Order_By>;
};

/** primary key columns input for table: items */
export type Items_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "items" */
export enum Items_Select_Column {
  /** column name */
  BrandId = 'brand_id',
  /** column name */
  BusinessId = 'business_id',
  /** column name */
  Color = 'color',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  Description = 'description',
  /** column name */
  EstimatedDeliveryTime = 'estimated_delivery_time',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  IsFragile = 'is_fragile',
  /** column name */
  IsPerishable = 'is_perishable',
  /** column name */
  ItemSubCategoryId = 'item_sub_category_id',
  /** column name */
  MaxDeliveryDistance = 'max_delivery_distance',
  /** column name */
  MaxOrderQuantity = 'max_order_quantity',
  /** column name */
  MinOrderQuantity = 'min_order_quantity',
  /** column name */
  Model = 'model',
  /** column name */
  Name = 'name',
  /** column name */
  Price = 'price',
  /** column name */
  RequiresSpecialHandling = 'requires_special_handling',
  /** column name */
  Sku = 'sku',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  Weight = 'weight',
  /** column name */
  WeightUnit = 'weight_unit'
}

/** select "items_aggregate_bool_exp_bool_and_arguments_columns" columns of table "items" */
export enum Items_Select_Column_Items_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsActive = 'is_active',
  /** column name */
  IsFragile = 'is_fragile',
  /** column name */
  IsPerishable = 'is_perishable',
  /** column name */
  RequiresSpecialHandling = 'requires_special_handling'
}

/** select "items_aggregate_bool_exp_bool_or_arguments_columns" columns of table "items" */
export enum Items_Select_Column_Items_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsActive = 'is_active',
  /** column name */
  IsFragile = 'is_fragile',
  /** column name */
  IsPerishable = 'is_perishable',
  /** column name */
  RequiresSpecialHandling = 'requires_special_handling'
}

/** input type for updating data in table "items" */
export type Items_Set_Input = {
  brand_id?: InputMaybe<Scalars['uuid']['input']>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  estimated_delivery_time?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  is_fragile?: InputMaybe<Scalars['Boolean']['input']>;
  is_perishable?: InputMaybe<Scalars['Boolean']['input']>;
  item_sub_category_id?: InputMaybe<Scalars['Int']['input']>;
  max_delivery_distance?: InputMaybe<Scalars['Int']['input']>;
  max_order_quantity?: InputMaybe<Scalars['Int']['input']>;
  min_order_quantity?: InputMaybe<Scalars['Int']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['numeric']['input']>;
  requires_special_handling?: InputMaybe<Scalars['Boolean']['input']>;
  sku?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  weight_unit?: InputMaybe<Scalars['weight_units_enum']['input']>;
};

/** aggregate stddev on columns */
export type Items_Stddev_Fields = {
  __typename?: 'items_stddev_fields';
  estimated_delivery_time?: Maybe<Scalars['Float']['output']>;
  item_sub_category_id?: Maybe<Scalars['Float']['output']>;
  max_delivery_distance?: Maybe<Scalars['Float']['output']>;
  max_order_quantity?: Maybe<Scalars['Float']['output']>;
  min_order_quantity?: Maybe<Scalars['Float']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "items" */
export type Items_Stddev_Order_By = {
  estimated_delivery_time?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Items_Stddev_Pop_Fields = {
  __typename?: 'items_stddev_pop_fields';
  estimated_delivery_time?: Maybe<Scalars['Float']['output']>;
  item_sub_category_id?: Maybe<Scalars['Float']['output']>;
  max_delivery_distance?: Maybe<Scalars['Float']['output']>;
  max_order_quantity?: Maybe<Scalars['Float']['output']>;
  min_order_quantity?: Maybe<Scalars['Float']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "items" */
export type Items_Stddev_Pop_Order_By = {
  estimated_delivery_time?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Items_Stddev_Samp_Fields = {
  __typename?: 'items_stddev_samp_fields';
  estimated_delivery_time?: Maybe<Scalars['Float']['output']>;
  item_sub_category_id?: Maybe<Scalars['Float']['output']>;
  max_delivery_distance?: Maybe<Scalars['Float']['output']>;
  max_order_quantity?: Maybe<Scalars['Float']['output']>;
  min_order_quantity?: Maybe<Scalars['Float']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "items" */
export type Items_Stddev_Samp_Order_By = {
  estimated_delivery_time?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "items" */
export type Items_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Items_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Items_Stream_Cursor_Value_Input = {
  brand_id?: InputMaybe<Scalars['uuid']['input']>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  estimated_delivery_time?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_active?: InputMaybe<Scalars['Boolean']['input']>;
  is_fragile?: InputMaybe<Scalars['Boolean']['input']>;
  is_perishable?: InputMaybe<Scalars['Boolean']['input']>;
  item_sub_category_id?: InputMaybe<Scalars['Int']['input']>;
  max_delivery_distance?: InputMaybe<Scalars['Int']['input']>;
  max_order_quantity?: InputMaybe<Scalars['Int']['input']>;
  min_order_quantity?: InputMaybe<Scalars['Int']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['numeric']['input']>;
  requires_special_handling?: InputMaybe<Scalars['Boolean']['input']>;
  sku?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  weight_unit?: InputMaybe<Scalars['weight_units_enum']['input']>;
};

/** aggregate sum on columns */
export type Items_Sum_Fields = {
  __typename?: 'items_sum_fields';
  estimated_delivery_time?: Maybe<Scalars['Int']['output']>;
  item_sub_category_id?: Maybe<Scalars['Int']['output']>;
  max_delivery_distance?: Maybe<Scalars['Int']['output']>;
  max_order_quantity?: Maybe<Scalars['Int']['output']>;
  min_order_quantity?: Maybe<Scalars['Int']['output']>;
  price?: Maybe<Scalars['numeric']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "items" */
export type Items_Sum_Order_By = {
  estimated_delivery_time?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** update columns of table "items" */
export enum Items_Update_Column {
  /** column name */
  BrandId = 'brand_id',
  /** column name */
  BusinessId = 'business_id',
  /** column name */
  Color = 'color',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  Description = 'description',
  /** column name */
  EstimatedDeliveryTime = 'estimated_delivery_time',
  /** column name */
  Id = 'id',
  /** column name */
  IsActive = 'is_active',
  /** column name */
  IsFragile = 'is_fragile',
  /** column name */
  IsPerishable = 'is_perishable',
  /** column name */
  ItemSubCategoryId = 'item_sub_category_id',
  /** column name */
  MaxDeliveryDistance = 'max_delivery_distance',
  /** column name */
  MaxOrderQuantity = 'max_order_quantity',
  /** column name */
  MinOrderQuantity = 'min_order_quantity',
  /** column name */
  Model = 'model',
  /** column name */
  Name = 'name',
  /** column name */
  Price = 'price',
  /** column name */
  RequiresSpecialHandling = 'requires_special_handling',
  /** column name */
  Sku = 'sku',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  Weight = 'weight',
  /** column name */
  WeightUnit = 'weight_unit'
}

export type Items_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Items_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Items_Set_Input>;
  /** filter the rows which have to be updated */
  where: Items_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Items_Var_Pop_Fields = {
  __typename?: 'items_var_pop_fields';
  estimated_delivery_time?: Maybe<Scalars['Float']['output']>;
  item_sub_category_id?: Maybe<Scalars['Float']['output']>;
  max_delivery_distance?: Maybe<Scalars['Float']['output']>;
  max_order_quantity?: Maybe<Scalars['Float']['output']>;
  min_order_quantity?: Maybe<Scalars['Float']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "items" */
export type Items_Var_Pop_Order_By = {
  estimated_delivery_time?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Items_Var_Samp_Fields = {
  __typename?: 'items_var_samp_fields';
  estimated_delivery_time?: Maybe<Scalars['Float']['output']>;
  item_sub_category_id?: Maybe<Scalars['Float']['output']>;
  max_delivery_distance?: Maybe<Scalars['Float']['output']>;
  max_order_quantity?: Maybe<Scalars['Float']['output']>;
  min_order_quantity?: Maybe<Scalars['Float']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "items" */
export type Items_Var_Samp_Order_By = {
  estimated_delivery_time?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Items_Variance_Fields = {
  __typename?: 'items_variance_fields';
  estimated_delivery_time?: Maybe<Scalars['Float']['output']>;
  item_sub_category_id?: Maybe<Scalars['Float']['output']>;
  max_delivery_distance?: Maybe<Scalars['Float']['output']>;
  max_order_quantity?: Maybe<Scalars['Float']['output']>;
  min_order_quantity?: Maybe<Scalars['Float']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "items" */
export type Items_Variance_Order_By = {
  estimated_delivery_time?: InputMaybe<Order_By>;
  item_sub_category_id?: InputMaybe<Order_By>;
  max_delivery_distance?: InputMaybe<Order_By>;
  max_order_quantity?: InputMaybe<Order_By>;
  min_order_quantity?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

export type Jsonb_Cast_Exp = {
  String?: InputMaybe<String_Comparison_Exp>;
};

/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
export type Jsonb_Comparison_Exp = {
  _cast?: InputMaybe<Jsonb_Cast_Exp>;
  /** is the column contained in the given json value */
  _contained_in?: InputMaybe<Scalars['jsonb']['input']>;
  /** does the column contain the given json value at the top level */
  _contains?: InputMaybe<Scalars['jsonb']['input']>;
  _eq?: InputMaybe<Scalars['jsonb']['input']>;
  _gt?: InputMaybe<Scalars['jsonb']['input']>;
  _gte?: InputMaybe<Scalars['jsonb']['input']>;
  /** does the string exist as a top-level key in the column */
  _has_key?: InputMaybe<Scalars['String']['input']>;
  /** do all of these strings exist as top-level keys in the column */
  _has_keys_all?: InputMaybe<Array<Scalars['String']['input']>>;
  /** do any of these strings exist as top-level keys in the column */
  _has_keys_any?: InputMaybe<Array<Scalars['String']['input']>>;
  _in?: InputMaybe<Array<Scalars['jsonb']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['jsonb']['input']>;
  _lte?: InputMaybe<Scalars['jsonb']['input']>;
  _neq?: InputMaybe<Scalars['jsonb']['input']>;
  _nin?: InputMaybe<Array<Scalars['jsonb']['input']>>;
};

/** Boolean expression to compare columns of type "location_type_enum". All fields are combined with logical 'AND'. */
export type Location_Type_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['location_type_enum']['input']>;
  _gt?: InputMaybe<Scalars['location_type_enum']['input']>;
  _gte?: InputMaybe<Scalars['location_type_enum']['input']>;
  _in?: InputMaybe<Array<Scalars['location_type_enum']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['location_type_enum']['input']>;
  _lte?: InputMaybe<Scalars['location_type_enum']['input']>;
  _neq?: InputMaybe<Scalars['location_type_enum']['input']>;
  _nin?: InputMaybe<Array<Scalars['location_type_enum']['input']>>;
};

/** Boolean expression to compare columns of type "mobile_payment_transaction_type_enum". All fields are combined with logical 'AND'. */
export type Mobile_Payment_Transaction_Type_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['mobile_payment_transaction_type_enum']['input']>;
  _gt?: InputMaybe<Scalars['mobile_payment_transaction_type_enum']['input']>;
  _gte?: InputMaybe<Scalars['mobile_payment_transaction_type_enum']['input']>;
  _in?: InputMaybe<Array<Scalars['mobile_payment_transaction_type_enum']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['mobile_payment_transaction_type_enum']['input']>;
  _lte?: InputMaybe<Scalars['mobile_payment_transaction_type_enum']['input']>;
  _neq?: InputMaybe<Scalars['mobile_payment_transaction_type_enum']['input']>;
  _nin?: InputMaybe<Array<Scalars['mobile_payment_transaction_type_enum']['input']>>;
};

/** columns and relationships of "mobile_payment_transactions" */
export type Mobile_Payment_Transactions = {
  __typename?: 'mobile_payment_transactions';
  /** An object relationship */
  account?: Maybe<Accounts>;
  /** Reference to the user account associated with this transaction */
  account_id?: Maybe<Scalars['uuid']['output']>;
  amount: Scalars['numeric']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency: Scalars['String']['output'];
  customer_email?: Maybe<Scalars['String']['output']>;
  customer_phone?: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  entity_id?: Maybe<Scalars['String']['output']>;
  error_code?: Maybe<Scalars['String']['output']>;
  error_message?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  /** An array relationship */
  payment_callbacks: Array<Payment_Callbacks>;
  /** An aggregate relationship */
  payment_callbacks_aggregate: Payment_Callbacks_Aggregate;
  payment_entity?: Maybe<Scalars['payment_entity_type']['output']>;
  payment_method: Scalars['String']['output'];
  provider: Scalars['String']['output'];
  reference: Scalars['String']['output'];
  status: Scalars['String']['output'];
  transaction_id?: Maybe<Scalars['String']['output']>;
  transaction_type: Scalars['mobile_payment_transaction_type_enum']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};


/** columns and relationships of "mobile_payment_transactions" */
export type Mobile_Payment_TransactionsPayment_CallbacksArgs = {
  distinct_on?: InputMaybe<Array<Payment_Callbacks_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Payment_Callbacks_Order_By>>;
  where?: InputMaybe<Payment_Callbacks_Bool_Exp>;
};


/** columns and relationships of "mobile_payment_transactions" */
export type Mobile_Payment_TransactionsPayment_Callbacks_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payment_Callbacks_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Payment_Callbacks_Order_By>>;
  where?: InputMaybe<Payment_Callbacks_Bool_Exp>;
};

/** aggregated selection of "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Aggregate = {
  __typename?: 'mobile_payment_transactions_aggregate';
  aggregate?: Maybe<Mobile_Payment_Transactions_Aggregate_Fields>;
  nodes: Array<Mobile_Payment_Transactions>;
};

export type Mobile_Payment_Transactions_Aggregate_Bool_Exp = {
  count?: InputMaybe<Mobile_Payment_Transactions_Aggregate_Bool_Exp_Count>;
};

export type Mobile_Payment_Transactions_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Mobile_Payment_Transactions_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Aggregate_Fields = {
  __typename?: 'mobile_payment_transactions_aggregate_fields';
  avg?: Maybe<Mobile_Payment_Transactions_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Mobile_Payment_Transactions_Max_Fields>;
  min?: Maybe<Mobile_Payment_Transactions_Min_Fields>;
  stddev?: Maybe<Mobile_Payment_Transactions_Stddev_Fields>;
  stddev_pop?: Maybe<Mobile_Payment_Transactions_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Mobile_Payment_Transactions_Stddev_Samp_Fields>;
  sum?: Maybe<Mobile_Payment_Transactions_Sum_Fields>;
  var_pop?: Maybe<Mobile_Payment_Transactions_Var_Pop_Fields>;
  var_samp?: Maybe<Mobile_Payment_Transactions_Var_Samp_Fields>;
  variance?: Maybe<Mobile_Payment_Transactions_Variance_Fields>;
};


/** aggregate fields of "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Mobile_Payment_Transactions_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Aggregate_Order_By = {
  avg?: InputMaybe<Mobile_Payment_Transactions_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Mobile_Payment_Transactions_Max_Order_By>;
  min?: InputMaybe<Mobile_Payment_Transactions_Min_Order_By>;
  stddev?: InputMaybe<Mobile_Payment_Transactions_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Mobile_Payment_Transactions_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Mobile_Payment_Transactions_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Mobile_Payment_Transactions_Sum_Order_By>;
  var_pop?: InputMaybe<Mobile_Payment_Transactions_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Mobile_Payment_Transactions_Var_Samp_Order_By>;
  variance?: InputMaybe<Mobile_Payment_Transactions_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Arr_Rel_Insert_Input = {
  data: Array<Mobile_Payment_Transactions_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Mobile_Payment_Transactions_On_Conflict>;
};

/** aggregate avg on columns */
export type Mobile_Payment_Transactions_Avg_Fields = {
  __typename?: 'mobile_payment_transactions_avg_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Avg_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "mobile_payment_transactions". All fields are combined with a logical 'AND'. */
export type Mobile_Payment_Transactions_Bool_Exp = {
  _and?: InputMaybe<Array<Mobile_Payment_Transactions_Bool_Exp>>;
  _not?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
  _or?: InputMaybe<Array<Mobile_Payment_Transactions_Bool_Exp>>;
  account?: InputMaybe<Accounts_Bool_Exp>;
  account_id?: InputMaybe<Uuid_Comparison_Exp>;
  amount?: InputMaybe<Numeric_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<String_Comparison_Exp>;
  customer_email?: InputMaybe<String_Comparison_Exp>;
  customer_phone?: InputMaybe<String_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  entity_id?: InputMaybe<String_Comparison_Exp>;
  error_code?: InputMaybe<String_Comparison_Exp>;
  error_message?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  payment_callbacks?: InputMaybe<Payment_Callbacks_Bool_Exp>;
  payment_callbacks_aggregate?: InputMaybe<Payment_Callbacks_Aggregate_Bool_Exp>;
  payment_entity?: InputMaybe<Payment_Entity_Type_Comparison_Exp>;
  payment_method?: InputMaybe<String_Comparison_Exp>;
  provider?: InputMaybe<String_Comparison_Exp>;
  reference?: InputMaybe<String_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  transaction_id?: InputMaybe<String_Comparison_Exp>;
  transaction_type?: InputMaybe<Mobile_Payment_Transaction_Type_Enum_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "mobile_payment_transactions" */
export enum Mobile_Payment_Transactions_Constraint {
  /** unique or primary key constraint on columns "id" */
  MobilePaymentTransactionsPkey = 'mobile_payment_transactions_pkey',
  /** unique or primary key constraint on columns "reference" */
  MobilePaymentTransactionsReferenceKey = 'mobile_payment_transactions_reference_key'
}

/** input type for incrementing numeric columns in table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Inc_Input = {
  amount?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Insert_Input = {
  account?: InputMaybe<Accounts_Obj_Rel_Insert_Input>;
  /** Reference to the user account associated with this transaction */
  account_id?: InputMaybe<Scalars['uuid']['input']>;
  amount?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  customer_email?: InputMaybe<Scalars['String']['input']>;
  customer_phone?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  entity_id?: InputMaybe<Scalars['String']['input']>;
  error_code?: InputMaybe<Scalars['String']['input']>;
  error_message?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  payment_callbacks?: InputMaybe<Payment_Callbacks_Arr_Rel_Insert_Input>;
  payment_entity?: InputMaybe<Scalars['payment_entity_type']['input']>;
  payment_method?: InputMaybe<Scalars['String']['input']>;
  provider?: InputMaybe<Scalars['String']['input']>;
  reference?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transaction_id?: InputMaybe<Scalars['String']['input']>;
  transaction_type?: InputMaybe<Scalars['mobile_payment_transaction_type_enum']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Mobile_Payment_Transactions_Max_Fields = {
  __typename?: 'mobile_payment_transactions_max_fields';
  /** Reference to the user account associated with this transaction */
  account_id?: Maybe<Scalars['uuid']['output']>;
  amount?: Maybe<Scalars['numeric']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  customer_email?: Maybe<Scalars['String']['output']>;
  customer_phone?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  entity_id?: Maybe<Scalars['String']['output']>;
  error_code?: Maybe<Scalars['String']['output']>;
  error_message?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  payment_entity?: Maybe<Scalars['payment_entity_type']['output']>;
  payment_method?: Maybe<Scalars['String']['output']>;
  provider?: Maybe<Scalars['String']['output']>;
  reference?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  transaction_id?: Maybe<Scalars['String']['output']>;
  transaction_type?: Maybe<Scalars['mobile_payment_transaction_type_enum']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Max_Order_By = {
  /** Reference to the user account associated with this transaction */
  account_id?: InputMaybe<Order_By>;
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  customer_email?: InputMaybe<Order_By>;
  customer_phone?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  entity_id?: InputMaybe<Order_By>;
  error_code?: InputMaybe<Order_By>;
  error_message?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  payment_entity?: InputMaybe<Order_By>;
  payment_method?: InputMaybe<Order_By>;
  provider?: InputMaybe<Order_By>;
  reference?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
  transaction_type?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Mobile_Payment_Transactions_Min_Fields = {
  __typename?: 'mobile_payment_transactions_min_fields';
  /** Reference to the user account associated with this transaction */
  account_id?: Maybe<Scalars['uuid']['output']>;
  amount?: Maybe<Scalars['numeric']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  customer_email?: Maybe<Scalars['String']['output']>;
  customer_phone?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  entity_id?: Maybe<Scalars['String']['output']>;
  error_code?: Maybe<Scalars['String']['output']>;
  error_message?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  payment_entity?: Maybe<Scalars['payment_entity_type']['output']>;
  payment_method?: Maybe<Scalars['String']['output']>;
  provider?: Maybe<Scalars['String']['output']>;
  reference?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  transaction_id?: Maybe<Scalars['String']['output']>;
  transaction_type?: Maybe<Scalars['mobile_payment_transaction_type_enum']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Min_Order_By = {
  /** Reference to the user account associated with this transaction */
  account_id?: InputMaybe<Order_By>;
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  customer_email?: InputMaybe<Order_By>;
  customer_phone?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  entity_id?: InputMaybe<Order_By>;
  error_code?: InputMaybe<Order_By>;
  error_message?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  payment_entity?: InputMaybe<Order_By>;
  payment_method?: InputMaybe<Order_By>;
  provider?: InputMaybe<Order_By>;
  reference?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
  transaction_type?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Mutation_Response = {
  __typename?: 'mobile_payment_transactions_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Mobile_Payment_Transactions>;
};

/** input type for inserting object relation for remote table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Obj_Rel_Insert_Input = {
  data: Mobile_Payment_Transactions_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Mobile_Payment_Transactions_On_Conflict>;
};

/** on_conflict condition type for table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_On_Conflict = {
  constraint: Mobile_Payment_Transactions_Constraint;
  update_columns?: Array<Mobile_Payment_Transactions_Update_Column>;
  where?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
};

/** Ordering options when selecting data from "mobile_payment_transactions". */
export type Mobile_Payment_Transactions_Order_By = {
  account?: InputMaybe<Accounts_Order_By>;
  account_id?: InputMaybe<Order_By>;
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  customer_email?: InputMaybe<Order_By>;
  customer_phone?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  entity_id?: InputMaybe<Order_By>;
  error_code?: InputMaybe<Order_By>;
  error_message?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  payment_callbacks_aggregate?: InputMaybe<Payment_Callbacks_Aggregate_Order_By>;
  payment_entity?: InputMaybe<Order_By>;
  payment_method?: InputMaybe<Order_By>;
  provider?: InputMaybe<Order_By>;
  reference?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
  transaction_type?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: mobile_payment_transactions */
export type Mobile_Payment_Transactions_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "mobile_payment_transactions" */
export enum Mobile_Payment_Transactions_Select_Column {
  /** column name */
  AccountId = 'account_id',
  /** column name */
  Amount = 'amount',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  CustomerEmail = 'customer_email',
  /** column name */
  CustomerPhone = 'customer_phone',
  /** column name */
  Description = 'description',
  /** column name */
  EntityId = 'entity_id',
  /** column name */
  ErrorCode = 'error_code',
  /** column name */
  ErrorMessage = 'error_message',
  /** column name */
  Id = 'id',
  /** column name */
  PaymentEntity = 'payment_entity',
  /** column name */
  PaymentMethod = 'payment_method',
  /** column name */
  Provider = 'provider',
  /** column name */
  Reference = 'reference',
  /** column name */
  Status = 'status',
  /** column name */
  TransactionId = 'transaction_id',
  /** column name */
  TransactionType = 'transaction_type',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Set_Input = {
  /** Reference to the user account associated with this transaction */
  account_id?: InputMaybe<Scalars['uuid']['input']>;
  amount?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  customer_email?: InputMaybe<Scalars['String']['input']>;
  customer_phone?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  entity_id?: InputMaybe<Scalars['String']['input']>;
  error_code?: InputMaybe<Scalars['String']['input']>;
  error_message?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  payment_entity?: InputMaybe<Scalars['payment_entity_type']['input']>;
  payment_method?: InputMaybe<Scalars['String']['input']>;
  provider?: InputMaybe<Scalars['String']['input']>;
  reference?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transaction_id?: InputMaybe<Scalars['String']['input']>;
  transaction_type?: InputMaybe<Scalars['mobile_payment_transaction_type_enum']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Mobile_Payment_Transactions_Stddev_Fields = {
  __typename?: 'mobile_payment_transactions_stddev_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Stddev_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Mobile_Payment_Transactions_Stddev_Pop_Fields = {
  __typename?: 'mobile_payment_transactions_stddev_pop_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Stddev_Pop_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Mobile_Payment_Transactions_Stddev_Samp_Fields = {
  __typename?: 'mobile_payment_transactions_stddev_samp_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Stddev_Samp_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Mobile_Payment_Transactions_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Mobile_Payment_Transactions_Stream_Cursor_Value_Input = {
  /** Reference to the user account associated with this transaction */
  account_id?: InputMaybe<Scalars['uuid']['input']>;
  amount?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  customer_email?: InputMaybe<Scalars['String']['input']>;
  customer_phone?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  entity_id?: InputMaybe<Scalars['String']['input']>;
  error_code?: InputMaybe<Scalars['String']['input']>;
  error_message?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  payment_entity?: InputMaybe<Scalars['payment_entity_type']['input']>;
  payment_method?: InputMaybe<Scalars['String']['input']>;
  provider?: InputMaybe<Scalars['String']['input']>;
  reference?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transaction_id?: InputMaybe<Scalars['String']['input']>;
  transaction_type?: InputMaybe<Scalars['mobile_payment_transaction_type_enum']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Mobile_Payment_Transactions_Sum_Fields = {
  __typename?: 'mobile_payment_transactions_sum_fields';
  amount?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Sum_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** update columns of table "mobile_payment_transactions" */
export enum Mobile_Payment_Transactions_Update_Column {
  /** column name */
  AccountId = 'account_id',
  /** column name */
  Amount = 'amount',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  CustomerEmail = 'customer_email',
  /** column name */
  CustomerPhone = 'customer_phone',
  /** column name */
  Description = 'description',
  /** column name */
  EntityId = 'entity_id',
  /** column name */
  ErrorCode = 'error_code',
  /** column name */
  ErrorMessage = 'error_message',
  /** column name */
  Id = 'id',
  /** column name */
  PaymentEntity = 'payment_entity',
  /** column name */
  PaymentMethod = 'payment_method',
  /** column name */
  Provider = 'provider',
  /** column name */
  Reference = 'reference',
  /** column name */
  Status = 'status',
  /** column name */
  TransactionId = 'transaction_id',
  /** column name */
  TransactionType = 'transaction_type',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Mobile_Payment_Transactions_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Mobile_Payment_Transactions_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Mobile_Payment_Transactions_Set_Input>;
  /** filter the rows which have to be updated */
  where: Mobile_Payment_Transactions_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Mobile_Payment_Transactions_Var_Pop_Fields = {
  __typename?: 'mobile_payment_transactions_var_pop_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Var_Pop_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Mobile_Payment_Transactions_Var_Samp_Fields = {
  __typename?: 'mobile_payment_transactions_var_samp_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Var_Samp_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Mobile_Payment_Transactions_Variance_Fields = {
  __typename?: 'mobile_payment_transactions_variance_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "mobile_payment_transactions" */
export type Mobile_Payment_Transactions_Variance_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** Tracks MTN MoMo payment requests made by users */
export type Mtn_Momo_Payment_Requests = {
  __typename?: 'mtn_momo_payment_requests';
  amount: Scalars['numeric']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency: Scalars['String']['output'];
  external_id: Scalars['String']['output'];
  id: Scalars['uuid']['output'];
  payee_note?: Maybe<Scalars['String']['output']>;
  payer_message?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  transaction_id: Scalars['String']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  /** An object relationship */
  user: Users;
  user_id: Scalars['uuid']['output'];
};

/** aggregated selection of "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Aggregate = {
  __typename?: 'mtn_momo_payment_requests_aggregate';
  aggregate?: Maybe<Mtn_Momo_Payment_Requests_Aggregate_Fields>;
  nodes: Array<Mtn_Momo_Payment_Requests>;
};

export type Mtn_Momo_Payment_Requests_Aggregate_Bool_Exp = {
  count?: InputMaybe<Mtn_Momo_Payment_Requests_Aggregate_Bool_Exp_Count>;
};

export type Mtn_Momo_Payment_Requests_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Aggregate_Fields = {
  __typename?: 'mtn_momo_payment_requests_aggregate_fields';
  avg?: Maybe<Mtn_Momo_Payment_Requests_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Mtn_Momo_Payment_Requests_Max_Fields>;
  min?: Maybe<Mtn_Momo_Payment_Requests_Min_Fields>;
  stddev?: Maybe<Mtn_Momo_Payment_Requests_Stddev_Fields>;
  stddev_pop?: Maybe<Mtn_Momo_Payment_Requests_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Mtn_Momo_Payment_Requests_Stddev_Samp_Fields>;
  sum?: Maybe<Mtn_Momo_Payment_Requests_Sum_Fields>;
  var_pop?: Maybe<Mtn_Momo_Payment_Requests_Var_Pop_Fields>;
  var_samp?: Maybe<Mtn_Momo_Payment_Requests_Var_Samp_Fields>;
  variance?: Maybe<Mtn_Momo_Payment_Requests_Variance_Fields>;
};


/** aggregate fields of "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Aggregate_Order_By = {
  avg?: InputMaybe<Mtn_Momo_Payment_Requests_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Mtn_Momo_Payment_Requests_Max_Order_By>;
  min?: InputMaybe<Mtn_Momo_Payment_Requests_Min_Order_By>;
  stddev?: InputMaybe<Mtn_Momo_Payment_Requests_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Mtn_Momo_Payment_Requests_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Mtn_Momo_Payment_Requests_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Mtn_Momo_Payment_Requests_Sum_Order_By>;
  var_pop?: InputMaybe<Mtn_Momo_Payment_Requests_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Mtn_Momo_Payment_Requests_Var_Samp_Order_By>;
  variance?: InputMaybe<Mtn_Momo_Payment_Requests_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Arr_Rel_Insert_Input = {
  data: Array<Mtn_Momo_Payment_Requests_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Mtn_Momo_Payment_Requests_On_Conflict>;
};

/** aggregate avg on columns */
export type Mtn_Momo_Payment_Requests_Avg_Fields = {
  __typename?: 'mtn_momo_payment_requests_avg_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Avg_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "mtn_momo_payment_requests". All fields are combined with a logical 'AND'. */
export type Mtn_Momo_Payment_Requests_Bool_Exp = {
  _and?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Bool_Exp>>;
  _not?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
  _or?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Bool_Exp>>;
  amount?: InputMaybe<Numeric_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<String_Comparison_Exp>;
  external_id?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  payee_note?: InputMaybe<String_Comparison_Exp>;
  payer_message?: InputMaybe<String_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  transaction_id?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "mtn_momo_payment_requests" */
export enum Mtn_Momo_Payment_Requests_Constraint {
  /** unique or primary key constraint on columns "transaction_id" */
  IdxMtnMomoPaymentRequestsTransactionIdUnique = 'idx_mtn_momo_payment_requests_transaction_id_unique',
  /** unique or primary key constraint on columns "id" */
  MtnMomoPaymentRequestsPkey = 'mtn_momo_payment_requests_pkey'
}

/** input type for incrementing numeric columns in table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Inc_Input = {
  amount?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Insert_Input = {
  amount?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  external_id?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  payee_note?: InputMaybe<Scalars['String']['input']>;
  payer_message?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transaction_id?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type Mtn_Momo_Payment_Requests_Max_Fields = {
  __typename?: 'mtn_momo_payment_requests_max_fields';
  amount?: Maybe<Scalars['numeric']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  external_id?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  payee_note?: Maybe<Scalars['String']['output']>;
  payer_message?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  transaction_id?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Max_Order_By = {
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  external_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  payee_note?: InputMaybe<Order_By>;
  payer_message?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Mtn_Momo_Payment_Requests_Min_Fields = {
  __typename?: 'mtn_momo_payment_requests_min_fields';
  amount?: Maybe<Scalars['numeric']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  external_id?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  payee_note?: Maybe<Scalars['String']['output']>;
  payer_message?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  transaction_id?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Min_Order_By = {
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  external_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  payee_note?: InputMaybe<Order_By>;
  payer_message?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Mutation_Response = {
  __typename?: 'mtn_momo_payment_requests_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Mtn_Momo_Payment_Requests>;
};

/** on_conflict condition type for table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_On_Conflict = {
  constraint: Mtn_Momo_Payment_Requests_Constraint;
  update_columns?: Array<Mtn_Momo_Payment_Requests_Update_Column>;
  where?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
};

/** Ordering options when selecting data from "mtn_momo_payment_requests". */
export type Mtn_Momo_Payment_Requests_Order_By = {
  amount?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  external_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  payee_note?: InputMaybe<Order_By>;
  payer_message?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: mtn_momo_payment_requests */
export type Mtn_Momo_Payment_Requests_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "mtn_momo_payment_requests" */
export enum Mtn_Momo_Payment_Requests_Select_Column {
  /** column name */
  Amount = 'amount',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  ExternalId = 'external_id',
  /** column name */
  Id = 'id',
  /** column name */
  PayeeNote = 'payee_note',
  /** column name */
  PayerMessage = 'payer_message',
  /** column name */
  Status = 'status',
  /** column name */
  TransactionId = 'transaction_id',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

/** input type for updating data in table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Set_Input = {
  amount?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  external_id?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  payee_note?: InputMaybe<Scalars['String']['input']>;
  payer_message?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transaction_id?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate stddev on columns */
export type Mtn_Momo_Payment_Requests_Stddev_Fields = {
  __typename?: 'mtn_momo_payment_requests_stddev_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Stddev_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Mtn_Momo_Payment_Requests_Stddev_Pop_Fields = {
  __typename?: 'mtn_momo_payment_requests_stddev_pop_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Stddev_Pop_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Mtn_Momo_Payment_Requests_Stddev_Samp_Fields = {
  __typename?: 'mtn_momo_payment_requests_stddev_samp_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Stddev_Samp_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Mtn_Momo_Payment_Requests_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Mtn_Momo_Payment_Requests_Stream_Cursor_Value_Input = {
  amount?: InputMaybe<Scalars['numeric']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  external_id?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  payee_note?: InputMaybe<Scalars['String']['input']>;
  payer_message?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transaction_id?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate sum on columns */
export type Mtn_Momo_Payment_Requests_Sum_Fields = {
  __typename?: 'mtn_momo_payment_requests_sum_fields';
  amount?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Sum_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** update columns of table "mtn_momo_payment_requests" */
export enum Mtn_Momo_Payment_Requests_Update_Column {
  /** column name */
  Amount = 'amount',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  ExternalId = 'external_id',
  /** column name */
  Id = 'id',
  /** column name */
  PayeeNote = 'payee_note',
  /** column name */
  PayerMessage = 'payer_message',
  /** column name */
  Status = 'status',
  /** column name */
  TransactionId = 'transaction_id',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

export type Mtn_Momo_Payment_Requests_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Mtn_Momo_Payment_Requests_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Mtn_Momo_Payment_Requests_Set_Input>;
  /** filter the rows which have to be updated */
  where: Mtn_Momo_Payment_Requests_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Mtn_Momo_Payment_Requests_Var_Pop_Fields = {
  __typename?: 'mtn_momo_payment_requests_var_pop_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Var_Pop_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Mtn_Momo_Payment_Requests_Var_Samp_Fields = {
  __typename?: 'mtn_momo_payment_requests_var_samp_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Var_Samp_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Mtn_Momo_Payment_Requests_Variance_Fields = {
  __typename?: 'mtn_momo_payment_requests_variance_fields';
  amount?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "mtn_momo_payment_requests" */
export type Mtn_Momo_Payment_Requests_Variance_Order_By = {
  amount?: InputMaybe<Order_By>;
};

/** mutation root */
export type Mutation_Root = {
  __typename?: 'mutation_root';
  /** delete data from the table: "account_transactions" */
  delete_account_transactions?: Maybe<Account_Transactions_Mutation_Response>;
  /** delete single row from the table: "account_transactions" */
  delete_account_transactions_by_pk?: Maybe<Account_Transactions>;
  /** delete data from the table: "accounts" */
  delete_accounts?: Maybe<Accounts_Mutation_Response>;
  /** delete single row from the table: "accounts" */
  delete_accounts_by_pk?: Maybe<Accounts>;
  /** delete data from the table: "addresses" */
  delete_addresses?: Maybe<Addresses_Mutation_Response>;
  /** delete single row from the table: "addresses" */
  delete_addresses_by_pk?: Maybe<Addresses>;
  /** delete data from the table: "agent_addresses" */
  delete_agent_addresses?: Maybe<Agent_Addresses_Mutation_Response>;
  /** delete single row from the table: "agent_addresses" */
  delete_agent_addresses_by_pk?: Maybe<Agent_Addresses>;
  /** delete data from the table: "agents" */
  delete_agents?: Maybe<Agents_Mutation_Response>;
  /** delete single row from the table: "agents" */
  delete_agents_by_pk?: Maybe<Agents>;
  /** delete data from the table: "airtel_money_payments" */
  delete_airtel_money_payments?: Maybe<Airtel_Money_Payments_Mutation_Response>;
  /** delete single row from the table: "airtel_money_payments" */
  delete_airtel_money_payments_by_pk?: Maybe<Airtel_Money_Payments>;
  /** delete data from the table: "application_configurations" */
  delete_application_configurations?: Maybe<Application_Configurations_Mutation_Response>;
  /** delete single row from the table: "application_configurations" */
  delete_application_configurations_by_pk?: Maybe<Application_Configurations>;
  /** delete data from the table: "brands" */
  delete_brands?: Maybe<Brands_Mutation_Response>;
  /** delete single row from the table: "brands" */
  delete_brands_by_pk?: Maybe<Brands>;
  /** delete data from the table: "business_addresses" */
  delete_business_addresses?: Maybe<Business_Addresses_Mutation_Response>;
  /** delete single row from the table: "business_addresses" */
  delete_business_addresses_by_pk?: Maybe<Business_Addresses>;
  /** delete data from the table: "business_inventory" */
  delete_business_inventory?: Maybe<Business_Inventory_Mutation_Response>;
  /** delete single row from the table: "business_inventory" */
  delete_business_inventory_by_pk?: Maybe<Business_Inventory>;
  /** delete data from the table: "business_locations" */
  delete_business_locations?: Maybe<Business_Locations_Mutation_Response>;
  /** delete single row from the table: "business_locations" */
  delete_business_locations_by_pk?: Maybe<Business_Locations>;
  /** delete data from the table: "businesses" */
  delete_businesses?: Maybe<Businesses_Mutation_Response>;
  /** delete single row from the table: "businesses" */
  delete_businesses_by_pk?: Maybe<Businesses>;
  /** delete data from the table: "client_addresses" */
  delete_client_addresses?: Maybe<Client_Addresses_Mutation_Response>;
  /** delete single row from the table: "client_addresses" */
  delete_client_addresses_by_pk?: Maybe<Client_Addresses>;
  /** delete data from the table: "clients" */
  delete_clients?: Maybe<Clients_Mutation_Response>;
  /** delete single row from the table: "clients" */
  delete_clients_by_pk?: Maybe<Clients>;
  /** delete data from the table: "delivery_fees" */
  delete_delivery_fees?: Maybe<Delivery_Fees_Mutation_Response>;
  /** delete single row from the table: "delivery_fees" */
  delete_delivery_fees_by_pk?: Maybe<Delivery_Fees>;
  /** delete data from the table: "delivery_time_slots" */
  delete_delivery_time_slots?: Maybe<Delivery_Time_Slots_Mutation_Response>;
  /** delete single row from the table: "delivery_time_slots" */
  delete_delivery_time_slots_by_pk?: Maybe<Delivery_Time_Slots>;
  /** delete data from the table: "delivery_time_windows" */
  delete_delivery_time_windows?: Maybe<Delivery_Time_Windows_Mutation_Response>;
  /** delete single row from the table: "delivery_time_windows" */
  delete_delivery_time_windows_by_pk?: Maybe<Delivery_Time_Windows>;
  /** delete data from the table: "document_types" */
  delete_document_types?: Maybe<Document_Types_Mutation_Response>;
  /** delete single row from the table: "document_types" */
  delete_document_types_by_pk?: Maybe<Document_Types>;
  /** delete data from the table: "entity_types" */
  delete_entity_types?: Maybe<Entity_Types_Mutation_Response>;
  /** delete single row from the table: "entity_types" */
  delete_entity_types_by_pk?: Maybe<Entity_Types>;
  /** delete data from the table: "google_distance_cache" */
  delete_google_distance_cache?: Maybe<Google_Distance_Cache_Mutation_Response>;
  /** delete single row from the table: "google_distance_cache" */
  delete_google_distance_cache_by_pk?: Maybe<Google_Distance_Cache>;
  /** delete data from the table: "google_geocode_cache" */
  delete_google_geocode_cache?: Maybe<Google_Geocode_Cache_Mutation_Response>;
  /** delete single row from the table: "google_geocode_cache" */
  delete_google_geocode_cache_by_pk?: Maybe<Google_Geocode_Cache>;
  /** delete data from the table: "item_categories" */
  delete_item_categories?: Maybe<Item_Categories_Mutation_Response>;
  /** delete single row from the table: "item_categories" */
  delete_item_categories_by_pk?: Maybe<Item_Categories>;
  /** delete data from the table: "item_images" */
  delete_item_images?: Maybe<Item_Images_Mutation_Response>;
  /** delete single row from the table: "item_images" */
  delete_item_images_by_pk?: Maybe<Item_Images>;
  /** delete data from the table: "item_sub_categories" */
  delete_item_sub_categories?: Maybe<Item_Sub_Categories_Mutation_Response>;
  /** delete single row from the table: "item_sub_categories" */
  delete_item_sub_categories_by_pk?: Maybe<Item_Sub_Categories>;
  /** delete data from the table: "items" */
  delete_items?: Maybe<Items_Mutation_Response>;
  /** delete single row from the table: "items" */
  delete_items_by_pk?: Maybe<Items>;
  /** delete data from the table: "mobile_payment_transactions" */
  delete_mobile_payment_transactions?: Maybe<Mobile_Payment_Transactions_Mutation_Response>;
  /** delete single row from the table: "mobile_payment_transactions" */
  delete_mobile_payment_transactions_by_pk?: Maybe<Mobile_Payment_Transactions>;
  /** delete data from the table: "mtn_momo_payment_requests" */
  delete_mtn_momo_payment_requests?: Maybe<Mtn_Momo_Payment_Requests_Mutation_Response>;
  /** delete single row from the table: "mtn_momo_payment_requests" */
  delete_mtn_momo_payment_requests_by_pk?: Maybe<Mtn_Momo_Payment_Requests>;
  /** delete data from the table: "order_cancellation_reasons" */
  delete_order_cancellation_reasons?: Maybe<Order_Cancellation_Reasons_Mutation_Response>;
  /** delete single row from the table: "order_cancellation_reasons" */
  delete_order_cancellation_reasons_by_pk?: Maybe<Order_Cancellation_Reasons>;
  /** delete data from the table: "order_holds" */
  delete_order_holds?: Maybe<Order_Holds_Mutation_Response>;
  /** delete single row from the table: "order_holds" */
  delete_order_holds_by_pk?: Maybe<Order_Holds>;
  /** delete data from the table: "order_items" */
  delete_order_items?: Maybe<Order_Items_Mutation_Response>;
  /** delete single row from the table: "order_items" */
  delete_order_items_by_pk?: Maybe<Order_Items>;
  /** delete data from the table: "order_status_history" */
  delete_order_status_history?: Maybe<Order_Status_History_Mutation_Response>;
  /** delete single row from the table: "order_status_history" */
  delete_order_status_history_by_pk?: Maybe<Order_Status_History>;
  /** delete data from the table: "orders" */
  delete_orders?: Maybe<Orders_Mutation_Response>;
  /** delete single row from the table: "orders" */
  delete_orders_by_pk?: Maybe<Orders>;
  /** delete data from the table: "payment_callbacks" */
  delete_payment_callbacks?: Maybe<Payment_Callbacks_Mutation_Response>;
  /** delete single row from the table: "payment_callbacks" */
  delete_payment_callbacks_by_pk?: Maybe<Payment_Callbacks>;
  /** delete data from the table: "rating_aggregates" */
  delete_rating_aggregates?: Maybe<Rating_Aggregates_Mutation_Response>;
  /** delete single row from the table: "rating_aggregates" */
  delete_rating_aggregates_by_pk?: Maybe<Rating_Aggregates>;
  /** delete data from the table: "ratings" */
  delete_ratings?: Maybe<Ratings_Mutation_Response>;
  /** delete single row from the table: "ratings" */
  delete_ratings_by_pk?: Maybe<Ratings>;
  /** delete data from the table: "supported_payment_systems" */
  delete_supported_payment_systems?: Maybe<Supported_Payment_Systems_Mutation_Response>;
  /** delete single row from the table: "supported_payment_systems" */
  delete_supported_payment_systems_by_pk?: Maybe<Supported_Payment_Systems>;
  /** delete data from the table: "user_messages" */
  delete_user_messages?: Maybe<User_Messages_Mutation_Response>;
  /** delete single row from the table: "user_messages" */
  delete_user_messages_by_pk?: Maybe<User_Messages>;
  /** delete data from the table: "user_types" */
  delete_user_types?: Maybe<User_Types_Mutation_Response>;
  /** delete single row from the table: "user_types" */
  delete_user_types_by_pk?: Maybe<User_Types>;
  /** delete data from the table: "user_uploads" */
  delete_user_uploads?: Maybe<User_Uploads_Mutation_Response>;
  /** delete single row from the table: "user_uploads" */
  delete_user_uploads_by_pk?: Maybe<User_Uploads>;
  /** delete data from the table: "users" */
  delete_users?: Maybe<Users_Mutation_Response>;
  /** delete single row from the table: "users" */
  delete_users_by_pk?: Maybe<Users>;
  /** delete data from the table: "vehicle_types" */
  delete_vehicle_types?: Maybe<Vehicle_Types_Mutation_Response>;
  /** delete single row from the table: "vehicle_types" */
  delete_vehicle_types_by_pk?: Maybe<Vehicle_Types>;
  /** insert data into the table: "account_transactions" */
  insert_account_transactions?: Maybe<Account_Transactions_Mutation_Response>;
  /** insert a single row into the table: "account_transactions" */
  insert_account_transactions_one?: Maybe<Account_Transactions>;
  /** insert data into the table: "accounts" */
  insert_accounts?: Maybe<Accounts_Mutation_Response>;
  /** insert a single row into the table: "accounts" */
  insert_accounts_one?: Maybe<Accounts>;
  /** insert data into the table: "addresses" */
  insert_addresses?: Maybe<Addresses_Mutation_Response>;
  /** insert a single row into the table: "addresses" */
  insert_addresses_one?: Maybe<Addresses>;
  /** insert data into the table: "agent_addresses" */
  insert_agent_addresses?: Maybe<Agent_Addresses_Mutation_Response>;
  /** insert a single row into the table: "agent_addresses" */
  insert_agent_addresses_one?: Maybe<Agent_Addresses>;
  /** insert data into the table: "agents" */
  insert_agents?: Maybe<Agents_Mutation_Response>;
  /** insert a single row into the table: "agents" */
  insert_agents_one?: Maybe<Agents>;
  /** insert data into the table: "airtel_money_payments" */
  insert_airtel_money_payments?: Maybe<Airtel_Money_Payments_Mutation_Response>;
  /** insert a single row into the table: "airtel_money_payments" */
  insert_airtel_money_payments_one?: Maybe<Airtel_Money_Payments>;
  /** insert data into the table: "application_configurations" */
  insert_application_configurations?: Maybe<Application_Configurations_Mutation_Response>;
  /** insert a single row into the table: "application_configurations" */
  insert_application_configurations_one?: Maybe<Application_Configurations>;
  /** insert data into the table: "brands" */
  insert_brands?: Maybe<Brands_Mutation_Response>;
  /** insert a single row into the table: "brands" */
  insert_brands_one?: Maybe<Brands>;
  /** insert data into the table: "business_addresses" */
  insert_business_addresses?: Maybe<Business_Addresses_Mutation_Response>;
  /** insert a single row into the table: "business_addresses" */
  insert_business_addresses_one?: Maybe<Business_Addresses>;
  /** insert data into the table: "business_inventory" */
  insert_business_inventory?: Maybe<Business_Inventory_Mutation_Response>;
  /** insert a single row into the table: "business_inventory" */
  insert_business_inventory_one?: Maybe<Business_Inventory>;
  /** insert data into the table: "business_locations" */
  insert_business_locations?: Maybe<Business_Locations_Mutation_Response>;
  /** insert a single row into the table: "business_locations" */
  insert_business_locations_one?: Maybe<Business_Locations>;
  /** insert data into the table: "businesses" */
  insert_businesses?: Maybe<Businesses_Mutation_Response>;
  /** insert a single row into the table: "businesses" */
  insert_businesses_one?: Maybe<Businesses>;
  /** insert data into the table: "client_addresses" */
  insert_client_addresses?: Maybe<Client_Addresses_Mutation_Response>;
  /** insert a single row into the table: "client_addresses" */
  insert_client_addresses_one?: Maybe<Client_Addresses>;
  /** insert data into the table: "clients" */
  insert_clients?: Maybe<Clients_Mutation_Response>;
  /** insert a single row into the table: "clients" */
  insert_clients_one?: Maybe<Clients>;
  /** insert data into the table: "delivery_fees" */
  insert_delivery_fees?: Maybe<Delivery_Fees_Mutation_Response>;
  /** insert a single row into the table: "delivery_fees" */
  insert_delivery_fees_one?: Maybe<Delivery_Fees>;
  /** insert data into the table: "delivery_time_slots" */
  insert_delivery_time_slots?: Maybe<Delivery_Time_Slots_Mutation_Response>;
  /** insert a single row into the table: "delivery_time_slots" */
  insert_delivery_time_slots_one?: Maybe<Delivery_Time_Slots>;
  /** insert data into the table: "delivery_time_windows" */
  insert_delivery_time_windows?: Maybe<Delivery_Time_Windows_Mutation_Response>;
  /** insert a single row into the table: "delivery_time_windows" */
  insert_delivery_time_windows_one?: Maybe<Delivery_Time_Windows>;
  /** insert data into the table: "document_types" */
  insert_document_types?: Maybe<Document_Types_Mutation_Response>;
  /** insert a single row into the table: "document_types" */
  insert_document_types_one?: Maybe<Document_Types>;
  /** insert data into the table: "entity_types" */
  insert_entity_types?: Maybe<Entity_Types_Mutation_Response>;
  /** insert a single row into the table: "entity_types" */
  insert_entity_types_one?: Maybe<Entity_Types>;
  /** insert data into the table: "google_distance_cache" */
  insert_google_distance_cache?: Maybe<Google_Distance_Cache_Mutation_Response>;
  /** insert a single row into the table: "google_distance_cache" */
  insert_google_distance_cache_one?: Maybe<Google_Distance_Cache>;
  /** insert data into the table: "google_geocode_cache" */
  insert_google_geocode_cache?: Maybe<Google_Geocode_Cache_Mutation_Response>;
  /** insert a single row into the table: "google_geocode_cache" */
  insert_google_geocode_cache_one?: Maybe<Google_Geocode_Cache>;
  /** insert data into the table: "item_categories" */
  insert_item_categories?: Maybe<Item_Categories_Mutation_Response>;
  /** insert a single row into the table: "item_categories" */
  insert_item_categories_one?: Maybe<Item_Categories>;
  /** insert data into the table: "item_images" */
  insert_item_images?: Maybe<Item_Images_Mutation_Response>;
  /** insert a single row into the table: "item_images" */
  insert_item_images_one?: Maybe<Item_Images>;
  /** insert data into the table: "item_sub_categories" */
  insert_item_sub_categories?: Maybe<Item_Sub_Categories_Mutation_Response>;
  /** insert a single row into the table: "item_sub_categories" */
  insert_item_sub_categories_one?: Maybe<Item_Sub_Categories>;
  /** insert data into the table: "items" */
  insert_items?: Maybe<Items_Mutation_Response>;
  /** insert a single row into the table: "items" */
  insert_items_one?: Maybe<Items>;
  /** insert data into the table: "mobile_payment_transactions" */
  insert_mobile_payment_transactions?: Maybe<Mobile_Payment_Transactions_Mutation_Response>;
  /** insert a single row into the table: "mobile_payment_transactions" */
  insert_mobile_payment_transactions_one?: Maybe<Mobile_Payment_Transactions>;
  /** insert data into the table: "mtn_momo_payment_requests" */
  insert_mtn_momo_payment_requests?: Maybe<Mtn_Momo_Payment_Requests_Mutation_Response>;
  /** insert a single row into the table: "mtn_momo_payment_requests" */
  insert_mtn_momo_payment_requests_one?: Maybe<Mtn_Momo_Payment_Requests>;
  /** insert data into the table: "order_cancellation_reasons" */
  insert_order_cancellation_reasons?: Maybe<Order_Cancellation_Reasons_Mutation_Response>;
  /** insert a single row into the table: "order_cancellation_reasons" */
  insert_order_cancellation_reasons_one?: Maybe<Order_Cancellation_Reasons>;
  /** insert data into the table: "order_holds" */
  insert_order_holds?: Maybe<Order_Holds_Mutation_Response>;
  /** insert a single row into the table: "order_holds" */
  insert_order_holds_one?: Maybe<Order_Holds>;
  /** insert data into the table: "order_items" */
  insert_order_items?: Maybe<Order_Items_Mutation_Response>;
  /** insert a single row into the table: "order_items" */
  insert_order_items_one?: Maybe<Order_Items>;
  /** insert data into the table: "order_status_history" */
  insert_order_status_history?: Maybe<Order_Status_History_Mutation_Response>;
  /** insert a single row into the table: "order_status_history" */
  insert_order_status_history_one?: Maybe<Order_Status_History>;
  /** insert data into the table: "orders" */
  insert_orders?: Maybe<Orders_Mutation_Response>;
  /** insert a single row into the table: "orders" */
  insert_orders_one?: Maybe<Orders>;
  /** insert data into the table: "payment_callbacks" */
  insert_payment_callbacks?: Maybe<Payment_Callbacks_Mutation_Response>;
  /** insert a single row into the table: "payment_callbacks" */
  insert_payment_callbacks_one?: Maybe<Payment_Callbacks>;
  /** insert data into the table: "rating_aggregates" */
  insert_rating_aggregates?: Maybe<Rating_Aggregates_Mutation_Response>;
  /** insert a single row into the table: "rating_aggregates" */
  insert_rating_aggregates_one?: Maybe<Rating_Aggregates>;
  /** insert data into the table: "ratings" */
  insert_ratings?: Maybe<Ratings_Mutation_Response>;
  /** insert a single row into the table: "ratings" */
  insert_ratings_one?: Maybe<Ratings>;
  /** insert data into the table: "supported_payment_systems" */
  insert_supported_payment_systems?: Maybe<Supported_Payment_Systems_Mutation_Response>;
  /** insert a single row into the table: "supported_payment_systems" */
  insert_supported_payment_systems_one?: Maybe<Supported_Payment_Systems>;
  /** insert data into the table: "user_messages" */
  insert_user_messages?: Maybe<User_Messages_Mutation_Response>;
  /** insert a single row into the table: "user_messages" */
  insert_user_messages_one?: Maybe<User_Messages>;
  /** insert data into the table: "user_types" */
  insert_user_types?: Maybe<User_Types_Mutation_Response>;
  /** insert a single row into the table: "user_types" */
  insert_user_types_one?: Maybe<User_Types>;
  /** insert data into the table: "user_uploads" */
  insert_user_uploads?: Maybe<User_Uploads_Mutation_Response>;
  /** insert a single row into the table: "user_uploads" */
  insert_user_uploads_one?: Maybe<User_Uploads>;
  /** insert data into the table: "users" */
  insert_users?: Maybe<Users_Mutation_Response>;
  /** insert a single row into the table: "users" */
  insert_users_one?: Maybe<Users>;
  /** insert data into the table: "vehicle_types" */
  insert_vehicle_types?: Maybe<Vehicle_Types_Mutation_Response>;
  /** insert a single row into the table: "vehicle_types" */
  insert_vehicle_types_one?: Maybe<Vehicle_Types>;
  /** update data of the table: "account_transactions" */
  update_account_transactions?: Maybe<Account_Transactions_Mutation_Response>;
  /** update single row of the table: "account_transactions" */
  update_account_transactions_by_pk?: Maybe<Account_Transactions>;
  /** update multiples rows of table: "account_transactions" */
  update_account_transactions_many?: Maybe<Array<Maybe<Account_Transactions_Mutation_Response>>>;
  /** update data of the table: "accounts" */
  update_accounts?: Maybe<Accounts_Mutation_Response>;
  /** update single row of the table: "accounts" */
  update_accounts_by_pk?: Maybe<Accounts>;
  /** update multiples rows of table: "accounts" */
  update_accounts_many?: Maybe<Array<Maybe<Accounts_Mutation_Response>>>;
  /** update data of the table: "addresses" */
  update_addresses?: Maybe<Addresses_Mutation_Response>;
  /** update single row of the table: "addresses" */
  update_addresses_by_pk?: Maybe<Addresses>;
  /** update multiples rows of table: "addresses" */
  update_addresses_many?: Maybe<Array<Maybe<Addresses_Mutation_Response>>>;
  /** update data of the table: "agent_addresses" */
  update_agent_addresses?: Maybe<Agent_Addresses_Mutation_Response>;
  /** update single row of the table: "agent_addresses" */
  update_agent_addresses_by_pk?: Maybe<Agent_Addresses>;
  /** update multiples rows of table: "agent_addresses" */
  update_agent_addresses_many?: Maybe<Array<Maybe<Agent_Addresses_Mutation_Response>>>;
  /** update data of the table: "agents" */
  update_agents?: Maybe<Agents_Mutation_Response>;
  /** update single row of the table: "agents" */
  update_agents_by_pk?: Maybe<Agents>;
  /** update multiples rows of table: "agents" */
  update_agents_many?: Maybe<Array<Maybe<Agents_Mutation_Response>>>;
  /** update data of the table: "airtel_money_payments" */
  update_airtel_money_payments?: Maybe<Airtel_Money_Payments_Mutation_Response>;
  /** update single row of the table: "airtel_money_payments" */
  update_airtel_money_payments_by_pk?: Maybe<Airtel_Money_Payments>;
  /** update multiples rows of table: "airtel_money_payments" */
  update_airtel_money_payments_many?: Maybe<Array<Maybe<Airtel_Money_Payments_Mutation_Response>>>;
  /** update data of the table: "application_configurations" */
  update_application_configurations?: Maybe<Application_Configurations_Mutation_Response>;
  /** update single row of the table: "application_configurations" */
  update_application_configurations_by_pk?: Maybe<Application_Configurations>;
  /** update multiples rows of table: "application_configurations" */
  update_application_configurations_many?: Maybe<Array<Maybe<Application_Configurations_Mutation_Response>>>;
  /** update data of the table: "brands" */
  update_brands?: Maybe<Brands_Mutation_Response>;
  /** update single row of the table: "brands" */
  update_brands_by_pk?: Maybe<Brands>;
  /** update multiples rows of table: "brands" */
  update_brands_many?: Maybe<Array<Maybe<Brands_Mutation_Response>>>;
  /** update data of the table: "business_addresses" */
  update_business_addresses?: Maybe<Business_Addresses_Mutation_Response>;
  /** update single row of the table: "business_addresses" */
  update_business_addresses_by_pk?: Maybe<Business_Addresses>;
  /** update multiples rows of table: "business_addresses" */
  update_business_addresses_many?: Maybe<Array<Maybe<Business_Addresses_Mutation_Response>>>;
  /** update data of the table: "business_inventory" */
  update_business_inventory?: Maybe<Business_Inventory_Mutation_Response>;
  /** update single row of the table: "business_inventory" */
  update_business_inventory_by_pk?: Maybe<Business_Inventory>;
  /** update multiples rows of table: "business_inventory" */
  update_business_inventory_many?: Maybe<Array<Maybe<Business_Inventory_Mutation_Response>>>;
  /** update data of the table: "business_locations" */
  update_business_locations?: Maybe<Business_Locations_Mutation_Response>;
  /** update single row of the table: "business_locations" */
  update_business_locations_by_pk?: Maybe<Business_Locations>;
  /** update multiples rows of table: "business_locations" */
  update_business_locations_many?: Maybe<Array<Maybe<Business_Locations_Mutation_Response>>>;
  /** update data of the table: "businesses" */
  update_businesses?: Maybe<Businesses_Mutation_Response>;
  /** update single row of the table: "businesses" */
  update_businesses_by_pk?: Maybe<Businesses>;
  /** update multiples rows of table: "businesses" */
  update_businesses_many?: Maybe<Array<Maybe<Businesses_Mutation_Response>>>;
  /** update data of the table: "client_addresses" */
  update_client_addresses?: Maybe<Client_Addresses_Mutation_Response>;
  /** update single row of the table: "client_addresses" */
  update_client_addresses_by_pk?: Maybe<Client_Addresses>;
  /** update multiples rows of table: "client_addresses" */
  update_client_addresses_many?: Maybe<Array<Maybe<Client_Addresses_Mutation_Response>>>;
  /** update data of the table: "clients" */
  update_clients?: Maybe<Clients_Mutation_Response>;
  /** update single row of the table: "clients" */
  update_clients_by_pk?: Maybe<Clients>;
  /** update multiples rows of table: "clients" */
  update_clients_many?: Maybe<Array<Maybe<Clients_Mutation_Response>>>;
  /** update data of the table: "delivery_fees" */
  update_delivery_fees?: Maybe<Delivery_Fees_Mutation_Response>;
  /** update single row of the table: "delivery_fees" */
  update_delivery_fees_by_pk?: Maybe<Delivery_Fees>;
  /** update multiples rows of table: "delivery_fees" */
  update_delivery_fees_many?: Maybe<Array<Maybe<Delivery_Fees_Mutation_Response>>>;
  /** update data of the table: "delivery_time_slots" */
  update_delivery_time_slots?: Maybe<Delivery_Time_Slots_Mutation_Response>;
  /** update single row of the table: "delivery_time_slots" */
  update_delivery_time_slots_by_pk?: Maybe<Delivery_Time_Slots>;
  /** update multiples rows of table: "delivery_time_slots" */
  update_delivery_time_slots_many?: Maybe<Array<Maybe<Delivery_Time_Slots_Mutation_Response>>>;
  /** update data of the table: "delivery_time_windows" */
  update_delivery_time_windows?: Maybe<Delivery_Time_Windows_Mutation_Response>;
  /** update single row of the table: "delivery_time_windows" */
  update_delivery_time_windows_by_pk?: Maybe<Delivery_Time_Windows>;
  /** update multiples rows of table: "delivery_time_windows" */
  update_delivery_time_windows_many?: Maybe<Array<Maybe<Delivery_Time_Windows_Mutation_Response>>>;
  /** update data of the table: "document_types" */
  update_document_types?: Maybe<Document_Types_Mutation_Response>;
  /** update single row of the table: "document_types" */
  update_document_types_by_pk?: Maybe<Document_Types>;
  /** update multiples rows of table: "document_types" */
  update_document_types_many?: Maybe<Array<Maybe<Document_Types_Mutation_Response>>>;
  /** update data of the table: "entity_types" */
  update_entity_types?: Maybe<Entity_Types_Mutation_Response>;
  /** update single row of the table: "entity_types" */
  update_entity_types_by_pk?: Maybe<Entity_Types>;
  /** update multiples rows of table: "entity_types" */
  update_entity_types_many?: Maybe<Array<Maybe<Entity_Types_Mutation_Response>>>;
  /** update data of the table: "google_distance_cache" */
  update_google_distance_cache?: Maybe<Google_Distance_Cache_Mutation_Response>;
  /** update single row of the table: "google_distance_cache" */
  update_google_distance_cache_by_pk?: Maybe<Google_Distance_Cache>;
  /** update multiples rows of table: "google_distance_cache" */
  update_google_distance_cache_many?: Maybe<Array<Maybe<Google_Distance_Cache_Mutation_Response>>>;
  /** update data of the table: "google_geocode_cache" */
  update_google_geocode_cache?: Maybe<Google_Geocode_Cache_Mutation_Response>;
  /** update single row of the table: "google_geocode_cache" */
  update_google_geocode_cache_by_pk?: Maybe<Google_Geocode_Cache>;
  /** update multiples rows of table: "google_geocode_cache" */
  update_google_geocode_cache_many?: Maybe<Array<Maybe<Google_Geocode_Cache_Mutation_Response>>>;
  /** update data of the table: "item_categories" */
  update_item_categories?: Maybe<Item_Categories_Mutation_Response>;
  /** update single row of the table: "item_categories" */
  update_item_categories_by_pk?: Maybe<Item_Categories>;
  /** update multiples rows of table: "item_categories" */
  update_item_categories_many?: Maybe<Array<Maybe<Item_Categories_Mutation_Response>>>;
  /** update data of the table: "item_images" */
  update_item_images?: Maybe<Item_Images_Mutation_Response>;
  /** update single row of the table: "item_images" */
  update_item_images_by_pk?: Maybe<Item_Images>;
  /** update multiples rows of table: "item_images" */
  update_item_images_many?: Maybe<Array<Maybe<Item_Images_Mutation_Response>>>;
  /** update data of the table: "item_sub_categories" */
  update_item_sub_categories?: Maybe<Item_Sub_Categories_Mutation_Response>;
  /** update single row of the table: "item_sub_categories" */
  update_item_sub_categories_by_pk?: Maybe<Item_Sub_Categories>;
  /** update multiples rows of table: "item_sub_categories" */
  update_item_sub_categories_many?: Maybe<Array<Maybe<Item_Sub_Categories_Mutation_Response>>>;
  /** update data of the table: "items" */
  update_items?: Maybe<Items_Mutation_Response>;
  /** update single row of the table: "items" */
  update_items_by_pk?: Maybe<Items>;
  /** update multiples rows of table: "items" */
  update_items_many?: Maybe<Array<Maybe<Items_Mutation_Response>>>;
  /** update data of the table: "mobile_payment_transactions" */
  update_mobile_payment_transactions?: Maybe<Mobile_Payment_Transactions_Mutation_Response>;
  /** update single row of the table: "mobile_payment_transactions" */
  update_mobile_payment_transactions_by_pk?: Maybe<Mobile_Payment_Transactions>;
  /** update multiples rows of table: "mobile_payment_transactions" */
  update_mobile_payment_transactions_many?: Maybe<Array<Maybe<Mobile_Payment_Transactions_Mutation_Response>>>;
  /** update data of the table: "mtn_momo_payment_requests" */
  update_mtn_momo_payment_requests?: Maybe<Mtn_Momo_Payment_Requests_Mutation_Response>;
  /** update single row of the table: "mtn_momo_payment_requests" */
  update_mtn_momo_payment_requests_by_pk?: Maybe<Mtn_Momo_Payment_Requests>;
  /** update multiples rows of table: "mtn_momo_payment_requests" */
  update_mtn_momo_payment_requests_many?: Maybe<Array<Maybe<Mtn_Momo_Payment_Requests_Mutation_Response>>>;
  /** update data of the table: "order_cancellation_reasons" */
  update_order_cancellation_reasons?: Maybe<Order_Cancellation_Reasons_Mutation_Response>;
  /** update single row of the table: "order_cancellation_reasons" */
  update_order_cancellation_reasons_by_pk?: Maybe<Order_Cancellation_Reasons>;
  /** update multiples rows of table: "order_cancellation_reasons" */
  update_order_cancellation_reasons_many?: Maybe<Array<Maybe<Order_Cancellation_Reasons_Mutation_Response>>>;
  /** update data of the table: "order_holds" */
  update_order_holds?: Maybe<Order_Holds_Mutation_Response>;
  /** update single row of the table: "order_holds" */
  update_order_holds_by_pk?: Maybe<Order_Holds>;
  /** update multiples rows of table: "order_holds" */
  update_order_holds_many?: Maybe<Array<Maybe<Order_Holds_Mutation_Response>>>;
  /** update data of the table: "order_items" */
  update_order_items?: Maybe<Order_Items_Mutation_Response>;
  /** update single row of the table: "order_items" */
  update_order_items_by_pk?: Maybe<Order_Items>;
  /** update multiples rows of table: "order_items" */
  update_order_items_many?: Maybe<Array<Maybe<Order_Items_Mutation_Response>>>;
  /** update data of the table: "order_status_history" */
  update_order_status_history?: Maybe<Order_Status_History_Mutation_Response>;
  /** update single row of the table: "order_status_history" */
  update_order_status_history_by_pk?: Maybe<Order_Status_History>;
  /** update multiples rows of table: "order_status_history" */
  update_order_status_history_many?: Maybe<Array<Maybe<Order_Status_History_Mutation_Response>>>;
  /** update data of the table: "orders" */
  update_orders?: Maybe<Orders_Mutation_Response>;
  /** update single row of the table: "orders" */
  update_orders_by_pk?: Maybe<Orders>;
  /** update multiples rows of table: "orders" */
  update_orders_many?: Maybe<Array<Maybe<Orders_Mutation_Response>>>;
  /** update data of the table: "payment_callbacks" */
  update_payment_callbacks?: Maybe<Payment_Callbacks_Mutation_Response>;
  /** update single row of the table: "payment_callbacks" */
  update_payment_callbacks_by_pk?: Maybe<Payment_Callbacks>;
  /** update multiples rows of table: "payment_callbacks" */
  update_payment_callbacks_many?: Maybe<Array<Maybe<Payment_Callbacks_Mutation_Response>>>;
  /** update data of the table: "rating_aggregates" */
  update_rating_aggregates?: Maybe<Rating_Aggregates_Mutation_Response>;
  /** update single row of the table: "rating_aggregates" */
  update_rating_aggregates_by_pk?: Maybe<Rating_Aggregates>;
  /** update multiples rows of table: "rating_aggregates" */
  update_rating_aggregates_many?: Maybe<Array<Maybe<Rating_Aggregates_Mutation_Response>>>;
  /** update data of the table: "ratings" */
  update_ratings?: Maybe<Ratings_Mutation_Response>;
  /** update single row of the table: "ratings" */
  update_ratings_by_pk?: Maybe<Ratings>;
  /** update multiples rows of table: "ratings" */
  update_ratings_many?: Maybe<Array<Maybe<Ratings_Mutation_Response>>>;
  /** update data of the table: "supported_payment_systems" */
  update_supported_payment_systems?: Maybe<Supported_Payment_Systems_Mutation_Response>;
  /** update single row of the table: "supported_payment_systems" */
  update_supported_payment_systems_by_pk?: Maybe<Supported_Payment_Systems>;
  /** update multiples rows of table: "supported_payment_systems" */
  update_supported_payment_systems_many?: Maybe<Array<Maybe<Supported_Payment_Systems_Mutation_Response>>>;
  /** update data of the table: "user_messages" */
  update_user_messages?: Maybe<User_Messages_Mutation_Response>;
  /** update single row of the table: "user_messages" */
  update_user_messages_by_pk?: Maybe<User_Messages>;
  /** update multiples rows of table: "user_messages" */
  update_user_messages_many?: Maybe<Array<Maybe<User_Messages_Mutation_Response>>>;
  /** update data of the table: "user_types" */
  update_user_types?: Maybe<User_Types_Mutation_Response>;
  /** update single row of the table: "user_types" */
  update_user_types_by_pk?: Maybe<User_Types>;
  /** update multiples rows of table: "user_types" */
  update_user_types_many?: Maybe<Array<Maybe<User_Types_Mutation_Response>>>;
  /** update data of the table: "user_uploads" */
  update_user_uploads?: Maybe<User_Uploads_Mutation_Response>;
  /** update single row of the table: "user_uploads" */
  update_user_uploads_by_pk?: Maybe<User_Uploads>;
  /** update multiples rows of table: "user_uploads" */
  update_user_uploads_many?: Maybe<Array<Maybe<User_Uploads_Mutation_Response>>>;
  /** update data of the table: "users" */
  update_users?: Maybe<Users_Mutation_Response>;
  /** update single row of the table: "users" */
  update_users_by_pk?: Maybe<Users>;
  /** update multiples rows of table: "users" */
  update_users_many?: Maybe<Array<Maybe<Users_Mutation_Response>>>;
  /** update data of the table: "vehicle_types" */
  update_vehicle_types?: Maybe<Vehicle_Types_Mutation_Response>;
  /** update single row of the table: "vehicle_types" */
  update_vehicle_types_by_pk?: Maybe<Vehicle_Types>;
  /** update multiples rows of table: "vehicle_types" */
  update_vehicle_types_many?: Maybe<Array<Maybe<Vehicle_Types_Mutation_Response>>>;
};


/** mutation root */
export type Mutation_RootDelete_Account_TransactionsArgs = {
  where: Account_Transactions_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Account_Transactions_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_AccountsArgs = {
  where: Accounts_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Accounts_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_AddressesArgs = {
  where: Addresses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Agent_AddressesArgs = {
  where: Agent_Addresses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Agent_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_AgentsArgs = {
  where: Agents_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Agents_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Airtel_Money_PaymentsArgs = {
  where: Airtel_Money_Payments_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Airtel_Money_Payments_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Application_ConfigurationsArgs = {
  where: Application_Configurations_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Application_Configurations_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_BrandsArgs = {
  where: Brands_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Brands_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Business_AddressesArgs = {
  where: Business_Addresses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Business_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Business_InventoryArgs = {
  where: Business_Inventory_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Business_Inventory_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Business_LocationsArgs = {
  where: Business_Locations_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Business_Locations_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_BusinessesArgs = {
  where: Businesses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Businesses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Client_AddressesArgs = {
  where: Client_Addresses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Client_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_ClientsArgs = {
  where: Clients_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Clients_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Delivery_FeesArgs = {
  where: Delivery_Fees_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Delivery_Fees_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Delivery_Time_SlotsArgs = {
  where: Delivery_Time_Slots_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Delivery_Time_Slots_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Delivery_Time_WindowsArgs = {
  where: Delivery_Time_Windows_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Delivery_Time_Windows_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Document_TypesArgs = {
  where: Document_Types_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Document_Types_By_PkArgs = {
  id: Scalars['Int']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Entity_TypesArgs = {
  where: Entity_Types_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Entity_Types_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Google_Distance_CacheArgs = {
  where: Google_Distance_Cache_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Google_Distance_Cache_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Google_Geocode_CacheArgs = {
  where: Google_Geocode_Cache_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Google_Geocode_Cache_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Item_CategoriesArgs = {
  where: Item_Categories_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Item_Categories_By_PkArgs = {
  id: Scalars['Int']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Item_ImagesArgs = {
  where: Item_Images_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Item_Images_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Item_Sub_CategoriesArgs = {
  where: Item_Sub_Categories_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Item_Sub_Categories_By_PkArgs = {
  id: Scalars['Int']['input'];
};


/** mutation root */
export type Mutation_RootDelete_ItemsArgs = {
  where: Items_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Items_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Mobile_Payment_TransactionsArgs = {
  where: Mobile_Payment_Transactions_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Mobile_Payment_Transactions_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Mtn_Momo_Payment_RequestsArgs = {
  where: Mtn_Momo_Payment_Requests_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Mtn_Momo_Payment_Requests_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Order_Cancellation_ReasonsArgs = {
  where: Order_Cancellation_Reasons_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Order_Cancellation_Reasons_By_PkArgs = {
  id: Scalars['Int']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Order_HoldsArgs = {
  where: Order_Holds_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Order_Holds_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Order_ItemsArgs = {
  where: Order_Items_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Order_Items_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Order_Status_HistoryArgs = {
  where: Order_Status_History_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Order_Status_History_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_OrdersArgs = {
  where: Orders_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Orders_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Payment_CallbacksArgs = {
  where: Payment_Callbacks_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Payment_Callbacks_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Rating_AggregatesArgs = {
  where: Rating_Aggregates_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Rating_Aggregates_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_RatingsArgs = {
  where: Ratings_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Ratings_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Supported_Payment_SystemsArgs = {
  where: Supported_Payment_Systems_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Supported_Payment_Systems_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_User_MessagesArgs = {
  where: User_Messages_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_User_Messages_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_User_TypesArgs = {
  where: User_Types_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_User_Types_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_User_UploadsArgs = {
  where: User_Uploads_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_User_Uploads_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_UsersArgs = {
  where: Users_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Users_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Vehicle_TypesArgs = {
  where: Vehicle_Types_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Vehicle_Types_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootInsert_Account_TransactionsArgs = {
  objects: Array<Account_Transactions_Insert_Input>;
  on_conflict?: InputMaybe<Account_Transactions_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Account_Transactions_OneArgs = {
  object: Account_Transactions_Insert_Input;
  on_conflict?: InputMaybe<Account_Transactions_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_AccountsArgs = {
  objects: Array<Accounts_Insert_Input>;
  on_conflict?: InputMaybe<Accounts_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Accounts_OneArgs = {
  object: Accounts_Insert_Input;
  on_conflict?: InputMaybe<Accounts_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_AddressesArgs = {
  objects: Array<Addresses_Insert_Input>;
  on_conflict?: InputMaybe<Addresses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Addresses_OneArgs = {
  object: Addresses_Insert_Input;
  on_conflict?: InputMaybe<Addresses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Agent_AddressesArgs = {
  objects: Array<Agent_Addresses_Insert_Input>;
  on_conflict?: InputMaybe<Agent_Addresses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Agent_Addresses_OneArgs = {
  object: Agent_Addresses_Insert_Input;
  on_conflict?: InputMaybe<Agent_Addresses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_AgentsArgs = {
  objects: Array<Agents_Insert_Input>;
  on_conflict?: InputMaybe<Agents_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Agents_OneArgs = {
  object: Agents_Insert_Input;
  on_conflict?: InputMaybe<Agents_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Airtel_Money_PaymentsArgs = {
  objects: Array<Airtel_Money_Payments_Insert_Input>;
  on_conflict?: InputMaybe<Airtel_Money_Payments_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Airtel_Money_Payments_OneArgs = {
  object: Airtel_Money_Payments_Insert_Input;
  on_conflict?: InputMaybe<Airtel_Money_Payments_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Application_ConfigurationsArgs = {
  objects: Array<Application_Configurations_Insert_Input>;
  on_conflict?: InputMaybe<Application_Configurations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Application_Configurations_OneArgs = {
  object: Application_Configurations_Insert_Input;
  on_conflict?: InputMaybe<Application_Configurations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_BrandsArgs = {
  objects: Array<Brands_Insert_Input>;
  on_conflict?: InputMaybe<Brands_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Brands_OneArgs = {
  object: Brands_Insert_Input;
  on_conflict?: InputMaybe<Brands_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Business_AddressesArgs = {
  objects: Array<Business_Addresses_Insert_Input>;
  on_conflict?: InputMaybe<Business_Addresses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Business_Addresses_OneArgs = {
  object: Business_Addresses_Insert_Input;
  on_conflict?: InputMaybe<Business_Addresses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Business_InventoryArgs = {
  objects: Array<Business_Inventory_Insert_Input>;
  on_conflict?: InputMaybe<Business_Inventory_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Business_Inventory_OneArgs = {
  object: Business_Inventory_Insert_Input;
  on_conflict?: InputMaybe<Business_Inventory_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Business_LocationsArgs = {
  objects: Array<Business_Locations_Insert_Input>;
  on_conflict?: InputMaybe<Business_Locations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Business_Locations_OneArgs = {
  object: Business_Locations_Insert_Input;
  on_conflict?: InputMaybe<Business_Locations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_BusinessesArgs = {
  objects: Array<Businesses_Insert_Input>;
  on_conflict?: InputMaybe<Businesses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Businesses_OneArgs = {
  object: Businesses_Insert_Input;
  on_conflict?: InputMaybe<Businesses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Client_AddressesArgs = {
  objects: Array<Client_Addresses_Insert_Input>;
  on_conflict?: InputMaybe<Client_Addresses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Client_Addresses_OneArgs = {
  object: Client_Addresses_Insert_Input;
  on_conflict?: InputMaybe<Client_Addresses_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_ClientsArgs = {
  objects: Array<Clients_Insert_Input>;
  on_conflict?: InputMaybe<Clients_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Clients_OneArgs = {
  object: Clients_Insert_Input;
  on_conflict?: InputMaybe<Clients_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Delivery_FeesArgs = {
  objects: Array<Delivery_Fees_Insert_Input>;
  on_conflict?: InputMaybe<Delivery_Fees_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Delivery_Fees_OneArgs = {
  object: Delivery_Fees_Insert_Input;
  on_conflict?: InputMaybe<Delivery_Fees_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Delivery_Time_SlotsArgs = {
  objects: Array<Delivery_Time_Slots_Insert_Input>;
  on_conflict?: InputMaybe<Delivery_Time_Slots_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Delivery_Time_Slots_OneArgs = {
  object: Delivery_Time_Slots_Insert_Input;
  on_conflict?: InputMaybe<Delivery_Time_Slots_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Delivery_Time_WindowsArgs = {
  objects: Array<Delivery_Time_Windows_Insert_Input>;
  on_conflict?: InputMaybe<Delivery_Time_Windows_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Delivery_Time_Windows_OneArgs = {
  object: Delivery_Time_Windows_Insert_Input;
  on_conflict?: InputMaybe<Delivery_Time_Windows_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Document_TypesArgs = {
  objects: Array<Document_Types_Insert_Input>;
  on_conflict?: InputMaybe<Document_Types_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Document_Types_OneArgs = {
  object: Document_Types_Insert_Input;
  on_conflict?: InputMaybe<Document_Types_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Entity_TypesArgs = {
  objects: Array<Entity_Types_Insert_Input>;
  on_conflict?: InputMaybe<Entity_Types_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Entity_Types_OneArgs = {
  object: Entity_Types_Insert_Input;
  on_conflict?: InputMaybe<Entity_Types_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Google_Distance_CacheArgs = {
  objects: Array<Google_Distance_Cache_Insert_Input>;
  on_conflict?: InputMaybe<Google_Distance_Cache_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Google_Distance_Cache_OneArgs = {
  object: Google_Distance_Cache_Insert_Input;
  on_conflict?: InputMaybe<Google_Distance_Cache_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Google_Geocode_CacheArgs = {
  objects: Array<Google_Geocode_Cache_Insert_Input>;
  on_conflict?: InputMaybe<Google_Geocode_Cache_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Google_Geocode_Cache_OneArgs = {
  object: Google_Geocode_Cache_Insert_Input;
  on_conflict?: InputMaybe<Google_Geocode_Cache_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Item_CategoriesArgs = {
  objects: Array<Item_Categories_Insert_Input>;
  on_conflict?: InputMaybe<Item_Categories_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Item_Categories_OneArgs = {
  object: Item_Categories_Insert_Input;
  on_conflict?: InputMaybe<Item_Categories_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Item_ImagesArgs = {
  objects: Array<Item_Images_Insert_Input>;
  on_conflict?: InputMaybe<Item_Images_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Item_Images_OneArgs = {
  object: Item_Images_Insert_Input;
  on_conflict?: InputMaybe<Item_Images_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Item_Sub_CategoriesArgs = {
  objects: Array<Item_Sub_Categories_Insert_Input>;
  on_conflict?: InputMaybe<Item_Sub_Categories_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Item_Sub_Categories_OneArgs = {
  object: Item_Sub_Categories_Insert_Input;
  on_conflict?: InputMaybe<Item_Sub_Categories_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_ItemsArgs = {
  objects: Array<Items_Insert_Input>;
  on_conflict?: InputMaybe<Items_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Items_OneArgs = {
  object: Items_Insert_Input;
  on_conflict?: InputMaybe<Items_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Mobile_Payment_TransactionsArgs = {
  objects: Array<Mobile_Payment_Transactions_Insert_Input>;
  on_conflict?: InputMaybe<Mobile_Payment_Transactions_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Mobile_Payment_Transactions_OneArgs = {
  object: Mobile_Payment_Transactions_Insert_Input;
  on_conflict?: InputMaybe<Mobile_Payment_Transactions_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Mtn_Momo_Payment_RequestsArgs = {
  objects: Array<Mtn_Momo_Payment_Requests_Insert_Input>;
  on_conflict?: InputMaybe<Mtn_Momo_Payment_Requests_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Mtn_Momo_Payment_Requests_OneArgs = {
  object: Mtn_Momo_Payment_Requests_Insert_Input;
  on_conflict?: InputMaybe<Mtn_Momo_Payment_Requests_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Order_Cancellation_ReasonsArgs = {
  objects: Array<Order_Cancellation_Reasons_Insert_Input>;
  on_conflict?: InputMaybe<Order_Cancellation_Reasons_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Order_Cancellation_Reasons_OneArgs = {
  object: Order_Cancellation_Reasons_Insert_Input;
  on_conflict?: InputMaybe<Order_Cancellation_Reasons_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Order_HoldsArgs = {
  objects: Array<Order_Holds_Insert_Input>;
  on_conflict?: InputMaybe<Order_Holds_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Order_Holds_OneArgs = {
  object: Order_Holds_Insert_Input;
  on_conflict?: InputMaybe<Order_Holds_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Order_ItemsArgs = {
  objects: Array<Order_Items_Insert_Input>;
  on_conflict?: InputMaybe<Order_Items_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Order_Items_OneArgs = {
  object: Order_Items_Insert_Input;
  on_conflict?: InputMaybe<Order_Items_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Order_Status_HistoryArgs = {
  objects: Array<Order_Status_History_Insert_Input>;
  on_conflict?: InputMaybe<Order_Status_History_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Order_Status_History_OneArgs = {
  object: Order_Status_History_Insert_Input;
  on_conflict?: InputMaybe<Order_Status_History_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_OrdersArgs = {
  objects: Array<Orders_Insert_Input>;
  on_conflict?: InputMaybe<Orders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Orders_OneArgs = {
  object: Orders_Insert_Input;
  on_conflict?: InputMaybe<Orders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Payment_CallbacksArgs = {
  objects: Array<Payment_Callbacks_Insert_Input>;
  on_conflict?: InputMaybe<Payment_Callbacks_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Payment_Callbacks_OneArgs = {
  object: Payment_Callbacks_Insert_Input;
  on_conflict?: InputMaybe<Payment_Callbacks_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Rating_AggregatesArgs = {
  objects: Array<Rating_Aggregates_Insert_Input>;
  on_conflict?: InputMaybe<Rating_Aggregates_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Rating_Aggregates_OneArgs = {
  object: Rating_Aggregates_Insert_Input;
  on_conflict?: InputMaybe<Rating_Aggregates_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_RatingsArgs = {
  objects: Array<Ratings_Insert_Input>;
  on_conflict?: InputMaybe<Ratings_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Ratings_OneArgs = {
  object: Ratings_Insert_Input;
  on_conflict?: InputMaybe<Ratings_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Supported_Payment_SystemsArgs = {
  objects: Array<Supported_Payment_Systems_Insert_Input>;
  on_conflict?: InputMaybe<Supported_Payment_Systems_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Supported_Payment_Systems_OneArgs = {
  object: Supported_Payment_Systems_Insert_Input;
  on_conflict?: InputMaybe<Supported_Payment_Systems_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_User_MessagesArgs = {
  objects: Array<User_Messages_Insert_Input>;
  on_conflict?: InputMaybe<User_Messages_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_User_Messages_OneArgs = {
  object: User_Messages_Insert_Input;
  on_conflict?: InputMaybe<User_Messages_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_User_TypesArgs = {
  objects: Array<User_Types_Insert_Input>;
  on_conflict?: InputMaybe<User_Types_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_User_Types_OneArgs = {
  object: User_Types_Insert_Input;
  on_conflict?: InputMaybe<User_Types_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_User_UploadsArgs = {
  objects: Array<User_Uploads_Insert_Input>;
  on_conflict?: InputMaybe<User_Uploads_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_User_Uploads_OneArgs = {
  object: User_Uploads_Insert_Input;
  on_conflict?: InputMaybe<User_Uploads_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_UsersArgs = {
  objects: Array<Users_Insert_Input>;
  on_conflict?: InputMaybe<Users_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Users_OneArgs = {
  object: Users_Insert_Input;
  on_conflict?: InputMaybe<Users_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Vehicle_TypesArgs = {
  objects: Array<Vehicle_Types_Insert_Input>;
  on_conflict?: InputMaybe<Vehicle_Types_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Vehicle_Types_OneArgs = {
  object: Vehicle_Types_Insert_Input;
  on_conflict?: InputMaybe<Vehicle_Types_On_Conflict>;
};


/** mutation root */
export type Mutation_RootUpdate_Account_TransactionsArgs = {
  _inc?: InputMaybe<Account_Transactions_Inc_Input>;
  _set?: InputMaybe<Account_Transactions_Set_Input>;
  where: Account_Transactions_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Account_Transactions_By_PkArgs = {
  _inc?: InputMaybe<Account_Transactions_Inc_Input>;
  _set?: InputMaybe<Account_Transactions_Set_Input>;
  pk_columns: Account_Transactions_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Account_Transactions_ManyArgs = {
  updates: Array<Account_Transactions_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AccountsArgs = {
  _inc?: InputMaybe<Accounts_Inc_Input>;
  _set?: InputMaybe<Accounts_Set_Input>;
  where: Accounts_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Accounts_By_PkArgs = {
  _inc?: InputMaybe<Accounts_Inc_Input>;
  _set?: InputMaybe<Accounts_Set_Input>;
  pk_columns: Accounts_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Accounts_ManyArgs = {
  updates: Array<Accounts_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AddressesArgs = {
  _inc?: InputMaybe<Addresses_Inc_Input>;
  _set?: InputMaybe<Addresses_Set_Input>;
  where: Addresses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Addresses_By_PkArgs = {
  _inc?: InputMaybe<Addresses_Inc_Input>;
  _set?: InputMaybe<Addresses_Set_Input>;
  pk_columns: Addresses_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Addresses_ManyArgs = {
  updates: Array<Addresses_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Agent_AddressesArgs = {
  _set?: InputMaybe<Agent_Addresses_Set_Input>;
  where: Agent_Addresses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Agent_Addresses_By_PkArgs = {
  _set?: InputMaybe<Agent_Addresses_Set_Input>;
  pk_columns: Agent_Addresses_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Agent_Addresses_ManyArgs = {
  updates: Array<Agent_Addresses_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AgentsArgs = {
  _set?: InputMaybe<Agents_Set_Input>;
  where: Agents_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Agents_By_PkArgs = {
  _set?: InputMaybe<Agents_Set_Input>;
  pk_columns: Agents_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Agents_ManyArgs = {
  updates: Array<Agents_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Airtel_Money_PaymentsArgs = {
  _append?: InputMaybe<Airtel_Money_Payments_Append_Input>;
  _delete_at_path?: InputMaybe<Airtel_Money_Payments_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Airtel_Money_Payments_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Airtel_Money_Payments_Delete_Key_Input>;
  _prepend?: InputMaybe<Airtel_Money_Payments_Prepend_Input>;
  _set?: InputMaybe<Airtel_Money_Payments_Set_Input>;
  where: Airtel_Money_Payments_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Airtel_Money_Payments_By_PkArgs = {
  _append?: InputMaybe<Airtel_Money_Payments_Append_Input>;
  _delete_at_path?: InputMaybe<Airtel_Money_Payments_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Airtel_Money_Payments_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Airtel_Money_Payments_Delete_Key_Input>;
  _prepend?: InputMaybe<Airtel_Money_Payments_Prepend_Input>;
  _set?: InputMaybe<Airtel_Money_Payments_Set_Input>;
  pk_columns: Airtel_Money_Payments_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Airtel_Money_Payments_ManyArgs = {
  updates: Array<Airtel_Money_Payments_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Application_ConfigurationsArgs = {
  _append?: InputMaybe<Application_Configurations_Append_Input>;
  _delete_at_path?: InputMaybe<Application_Configurations_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Application_Configurations_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Application_Configurations_Delete_Key_Input>;
  _inc?: InputMaybe<Application_Configurations_Inc_Input>;
  _prepend?: InputMaybe<Application_Configurations_Prepend_Input>;
  _set?: InputMaybe<Application_Configurations_Set_Input>;
  where: Application_Configurations_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Application_Configurations_By_PkArgs = {
  _append?: InputMaybe<Application_Configurations_Append_Input>;
  _delete_at_path?: InputMaybe<Application_Configurations_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Application_Configurations_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Application_Configurations_Delete_Key_Input>;
  _inc?: InputMaybe<Application_Configurations_Inc_Input>;
  _prepend?: InputMaybe<Application_Configurations_Prepend_Input>;
  _set?: InputMaybe<Application_Configurations_Set_Input>;
  pk_columns: Application_Configurations_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Application_Configurations_ManyArgs = {
  updates: Array<Application_Configurations_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_BrandsArgs = {
  _set?: InputMaybe<Brands_Set_Input>;
  where: Brands_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Brands_By_PkArgs = {
  _set?: InputMaybe<Brands_Set_Input>;
  pk_columns: Brands_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Brands_ManyArgs = {
  updates: Array<Brands_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Business_AddressesArgs = {
  _set?: InputMaybe<Business_Addresses_Set_Input>;
  where: Business_Addresses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Business_Addresses_By_PkArgs = {
  _set?: InputMaybe<Business_Addresses_Set_Input>;
  pk_columns: Business_Addresses_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Business_Addresses_ManyArgs = {
  updates: Array<Business_Addresses_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Business_InventoryArgs = {
  _inc?: InputMaybe<Business_Inventory_Inc_Input>;
  _set?: InputMaybe<Business_Inventory_Set_Input>;
  where: Business_Inventory_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Business_Inventory_By_PkArgs = {
  _inc?: InputMaybe<Business_Inventory_Inc_Input>;
  _set?: InputMaybe<Business_Inventory_Set_Input>;
  pk_columns: Business_Inventory_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Business_Inventory_ManyArgs = {
  updates: Array<Business_Inventory_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Business_LocationsArgs = {
  _append?: InputMaybe<Business_Locations_Append_Input>;
  _delete_at_path?: InputMaybe<Business_Locations_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Business_Locations_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Business_Locations_Delete_Key_Input>;
  _prepend?: InputMaybe<Business_Locations_Prepend_Input>;
  _set?: InputMaybe<Business_Locations_Set_Input>;
  where: Business_Locations_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Business_Locations_By_PkArgs = {
  _append?: InputMaybe<Business_Locations_Append_Input>;
  _delete_at_path?: InputMaybe<Business_Locations_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Business_Locations_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Business_Locations_Delete_Key_Input>;
  _prepend?: InputMaybe<Business_Locations_Prepend_Input>;
  _set?: InputMaybe<Business_Locations_Set_Input>;
  pk_columns: Business_Locations_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Business_Locations_ManyArgs = {
  updates: Array<Business_Locations_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_BusinessesArgs = {
  _set?: InputMaybe<Businesses_Set_Input>;
  where: Businesses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Businesses_By_PkArgs = {
  _set?: InputMaybe<Businesses_Set_Input>;
  pk_columns: Businesses_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Businesses_ManyArgs = {
  updates: Array<Businesses_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Client_AddressesArgs = {
  _set?: InputMaybe<Client_Addresses_Set_Input>;
  where: Client_Addresses_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Client_Addresses_By_PkArgs = {
  _set?: InputMaybe<Client_Addresses_Set_Input>;
  pk_columns: Client_Addresses_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Client_Addresses_ManyArgs = {
  updates: Array<Client_Addresses_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ClientsArgs = {
  _set?: InputMaybe<Clients_Set_Input>;
  where: Clients_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Clients_By_PkArgs = {
  _set?: InputMaybe<Clients_Set_Input>;
  pk_columns: Clients_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Clients_ManyArgs = {
  updates: Array<Clients_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Delivery_FeesArgs = {
  _append?: InputMaybe<Delivery_Fees_Append_Input>;
  _delete_at_path?: InputMaybe<Delivery_Fees_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Delivery_Fees_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Delivery_Fees_Delete_Key_Input>;
  _inc?: InputMaybe<Delivery_Fees_Inc_Input>;
  _prepend?: InputMaybe<Delivery_Fees_Prepend_Input>;
  _set?: InputMaybe<Delivery_Fees_Set_Input>;
  where: Delivery_Fees_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Delivery_Fees_By_PkArgs = {
  _append?: InputMaybe<Delivery_Fees_Append_Input>;
  _delete_at_path?: InputMaybe<Delivery_Fees_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Delivery_Fees_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Delivery_Fees_Delete_Key_Input>;
  _inc?: InputMaybe<Delivery_Fees_Inc_Input>;
  _prepend?: InputMaybe<Delivery_Fees_Prepend_Input>;
  _set?: InputMaybe<Delivery_Fees_Set_Input>;
  pk_columns: Delivery_Fees_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Delivery_Fees_ManyArgs = {
  updates: Array<Delivery_Fees_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Delivery_Time_SlotsArgs = {
  _inc?: InputMaybe<Delivery_Time_Slots_Inc_Input>;
  _set?: InputMaybe<Delivery_Time_Slots_Set_Input>;
  where: Delivery_Time_Slots_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Delivery_Time_Slots_By_PkArgs = {
  _inc?: InputMaybe<Delivery_Time_Slots_Inc_Input>;
  _set?: InputMaybe<Delivery_Time_Slots_Set_Input>;
  pk_columns: Delivery_Time_Slots_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Delivery_Time_Slots_ManyArgs = {
  updates: Array<Delivery_Time_Slots_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Delivery_Time_WindowsArgs = {
  _set?: InputMaybe<Delivery_Time_Windows_Set_Input>;
  where: Delivery_Time_Windows_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Delivery_Time_Windows_By_PkArgs = {
  _set?: InputMaybe<Delivery_Time_Windows_Set_Input>;
  pk_columns: Delivery_Time_Windows_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Delivery_Time_Windows_ManyArgs = {
  updates: Array<Delivery_Time_Windows_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Document_TypesArgs = {
  _inc?: InputMaybe<Document_Types_Inc_Input>;
  _set?: InputMaybe<Document_Types_Set_Input>;
  where: Document_Types_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Document_Types_By_PkArgs = {
  _inc?: InputMaybe<Document_Types_Inc_Input>;
  _set?: InputMaybe<Document_Types_Set_Input>;
  pk_columns: Document_Types_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Document_Types_ManyArgs = {
  updates: Array<Document_Types_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Entity_TypesArgs = {
  _set?: InputMaybe<Entity_Types_Set_Input>;
  where: Entity_Types_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Entity_Types_By_PkArgs = {
  _set?: InputMaybe<Entity_Types_Set_Input>;
  pk_columns: Entity_Types_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Entity_Types_ManyArgs = {
  updates: Array<Entity_Types_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Google_Distance_CacheArgs = {
  _inc?: InputMaybe<Google_Distance_Cache_Inc_Input>;
  _set?: InputMaybe<Google_Distance_Cache_Set_Input>;
  where: Google_Distance_Cache_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Google_Distance_Cache_By_PkArgs = {
  _inc?: InputMaybe<Google_Distance_Cache_Inc_Input>;
  _set?: InputMaybe<Google_Distance_Cache_Set_Input>;
  pk_columns: Google_Distance_Cache_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Google_Distance_Cache_ManyArgs = {
  updates: Array<Google_Distance_Cache_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Google_Geocode_CacheArgs = {
  _append?: InputMaybe<Google_Geocode_Cache_Append_Input>;
  _delete_at_path?: InputMaybe<Google_Geocode_Cache_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Google_Geocode_Cache_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Google_Geocode_Cache_Delete_Key_Input>;
  _inc?: InputMaybe<Google_Geocode_Cache_Inc_Input>;
  _prepend?: InputMaybe<Google_Geocode_Cache_Prepend_Input>;
  _set?: InputMaybe<Google_Geocode_Cache_Set_Input>;
  where: Google_Geocode_Cache_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Google_Geocode_Cache_By_PkArgs = {
  _append?: InputMaybe<Google_Geocode_Cache_Append_Input>;
  _delete_at_path?: InputMaybe<Google_Geocode_Cache_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Google_Geocode_Cache_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Google_Geocode_Cache_Delete_Key_Input>;
  _inc?: InputMaybe<Google_Geocode_Cache_Inc_Input>;
  _prepend?: InputMaybe<Google_Geocode_Cache_Prepend_Input>;
  _set?: InputMaybe<Google_Geocode_Cache_Set_Input>;
  pk_columns: Google_Geocode_Cache_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Google_Geocode_Cache_ManyArgs = {
  updates: Array<Google_Geocode_Cache_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Item_CategoriesArgs = {
  _inc?: InputMaybe<Item_Categories_Inc_Input>;
  _set?: InputMaybe<Item_Categories_Set_Input>;
  where: Item_Categories_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Item_Categories_By_PkArgs = {
  _inc?: InputMaybe<Item_Categories_Inc_Input>;
  _set?: InputMaybe<Item_Categories_Set_Input>;
  pk_columns: Item_Categories_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Item_Categories_ManyArgs = {
  updates: Array<Item_Categories_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Item_ImagesArgs = {
  _inc?: InputMaybe<Item_Images_Inc_Input>;
  _set?: InputMaybe<Item_Images_Set_Input>;
  where: Item_Images_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Item_Images_By_PkArgs = {
  _inc?: InputMaybe<Item_Images_Inc_Input>;
  _set?: InputMaybe<Item_Images_Set_Input>;
  pk_columns: Item_Images_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Item_Images_ManyArgs = {
  updates: Array<Item_Images_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Item_Sub_CategoriesArgs = {
  _inc?: InputMaybe<Item_Sub_Categories_Inc_Input>;
  _set?: InputMaybe<Item_Sub_Categories_Set_Input>;
  where: Item_Sub_Categories_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Item_Sub_Categories_By_PkArgs = {
  _inc?: InputMaybe<Item_Sub_Categories_Inc_Input>;
  _set?: InputMaybe<Item_Sub_Categories_Set_Input>;
  pk_columns: Item_Sub_Categories_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Item_Sub_Categories_ManyArgs = {
  updates: Array<Item_Sub_Categories_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ItemsArgs = {
  _inc?: InputMaybe<Items_Inc_Input>;
  _set?: InputMaybe<Items_Set_Input>;
  where: Items_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Items_By_PkArgs = {
  _inc?: InputMaybe<Items_Inc_Input>;
  _set?: InputMaybe<Items_Set_Input>;
  pk_columns: Items_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Items_ManyArgs = {
  updates: Array<Items_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Mobile_Payment_TransactionsArgs = {
  _inc?: InputMaybe<Mobile_Payment_Transactions_Inc_Input>;
  _set?: InputMaybe<Mobile_Payment_Transactions_Set_Input>;
  where: Mobile_Payment_Transactions_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Mobile_Payment_Transactions_By_PkArgs = {
  _inc?: InputMaybe<Mobile_Payment_Transactions_Inc_Input>;
  _set?: InputMaybe<Mobile_Payment_Transactions_Set_Input>;
  pk_columns: Mobile_Payment_Transactions_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Mobile_Payment_Transactions_ManyArgs = {
  updates: Array<Mobile_Payment_Transactions_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Mtn_Momo_Payment_RequestsArgs = {
  _inc?: InputMaybe<Mtn_Momo_Payment_Requests_Inc_Input>;
  _set?: InputMaybe<Mtn_Momo_Payment_Requests_Set_Input>;
  where: Mtn_Momo_Payment_Requests_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Mtn_Momo_Payment_Requests_By_PkArgs = {
  _inc?: InputMaybe<Mtn_Momo_Payment_Requests_Inc_Input>;
  _set?: InputMaybe<Mtn_Momo_Payment_Requests_Set_Input>;
  pk_columns: Mtn_Momo_Payment_Requests_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Mtn_Momo_Payment_Requests_ManyArgs = {
  updates: Array<Mtn_Momo_Payment_Requests_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Cancellation_ReasonsArgs = {
  _inc?: InputMaybe<Order_Cancellation_Reasons_Inc_Input>;
  _set?: InputMaybe<Order_Cancellation_Reasons_Set_Input>;
  where: Order_Cancellation_Reasons_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Cancellation_Reasons_By_PkArgs = {
  _inc?: InputMaybe<Order_Cancellation_Reasons_Inc_Input>;
  _set?: InputMaybe<Order_Cancellation_Reasons_Set_Input>;
  pk_columns: Order_Cancellation_Reasons_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Cancellation_Reasons_ManyArgs = {
  updates: Array<Order_Cancellation_Reasons_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Order_HoldsArgs = {
  _inc?: InputMaybe<Order_Holds_Inc_Input>;
  _set?: InputMaybe<Order_Holds_Set_Input>;
  where: Order_Holds_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Holds_By_PkArgs = {
  _inc?: InputMaybe<Order_Holds_Inc_Input>;
  _set?: InputMaybe<Order_Holds_Set_Input>;
  pk_columns: Order_Holds_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Holds_ManyArgs = {
  updates: Array<Order_Holds_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Order_ItemsArgs = {
  _inc?: InputMaybe<Order_Items_Inc_Input>;
  _set?: InputMaybe<Order_Items_Set_Input>;
  where: Order_Items_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Items_By_PkArgs = {
  _inc?: InputMaybe<Order_Items_Inc_Input>;
  _set?: InputMaybe<Order_Items_Set_Input>;
  pk_columns: Order_Items_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Items_ManyArgs = {
  updates: Array<Order_Items_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Status_HistoryArgs = {
  _inc?: InputMaybe<Order_Status_History_Inc_Input>;
  _set?: InputMaybe<Order_Status_History_Set_Input>;
  where: Order_Status_History_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Status_History_By_PkArgs = {
  _inc?: InputMaybe<Order_Status_History_Inc_Input>;
  _set?: InputMaybe<Order_Status_History_Set_Input>;
  pk_columns: Order_Status_History_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Order_Status_History_ManyArgs = {
  updates: Array<Order_Status_History_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_OrdersArgs = {
  _inc?: InputMaybe<Orders_Inc_Input>;
  _set?: InputMaybe<Orders_Set_Input>;
  where: Orders_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Orders_By_PkArgs = {
  _inc?: InputMaybe<Orders_Inc_Input>;
  _set?: InputMaybe<Orders_Set_Input>;
  pk_columns: Orders_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Orders_ManyArgs = {
  updates: Array<Orders_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Payment_CallbacksArgs = {
  _append?: InputMaybe<Payment_Callbacks_Append_Input>;
  _delete_at_path?: InputMaybe<Payment_Callbacks_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Payment_Callbacks_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Payment_Callbacks_Delete_Key_Input>;
  _prepend?: InputMaybe<Payment_Callbacks_Prepend_Input>;
  _set?: InputMaybe<Payment_Callbacks_Set_Input>;
  where: Payment_Callbacks_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Payment_Callbacks_By_PkArgs = {
  _append?: InputMaybe<Payment_Callbacks_Append_Input>;
  _delete_at_path?: InputMaybe<Payment_Callbacks_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Payment_Callbacks_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Payment_Callbacks_Delete_Key_Input>;
  _prepend?: InputMaybe<Payment_Callbacks_Prepend_Input>;
  _set?: InputMaybe<Payment_Callbacks_Set_Input>;
  pk_columns: Payment_Callbacks_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Payment_Callbacks_ManyArgs = {
  updates: Array<Payment_Callbacks_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Rating_AggregatesArgs = {
  _inc?: InputMaybe<Rating_Aggregates_Inc_Input>;
  _set?: InputMaybe<Rating_Aggregates_Set_Input>;
  where: Rating_Aggregates_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Rating_Aggregates_By_PkArgs = {
  _inc?: InputMaybe<Rating_Aggregates_Inc_Input>;
  _set?: InputMaybe<Rating_Aggregates_Set_Input>;
  pk_columns: Rating_Aggregates_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Rating_Aggregates_ManyArgs = {
  updates: Array<Rating_Aggregates_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_RatingsArgs = {
  _inc?: InputMaybe<Ratings_Inc_Input>;
  _set?: InputMaybe<Ratings_Set_Input>;
  where: Ratings_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Ratings_By_PkArgs = {
  _inc?: InputMaybe<Ratings_Inc_Input>;
  _set?: InputMaybe<Ratings_Set_Input>;
  pk_columns: Ratings_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Ratings_ManyArgs = {
  updates: Array<Ratings_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Supported_Payment_SystemsArgs = {
  _set?: InputMaybe<Supported_Payment_Systems_Set_Input>;
  where: Supported_Payment_Systems_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Supported_Payment_Systems_By_PkArgs = {
  _set?: InputMaybe<Supported_Payment_Systems_Set_Input>;
  pk_columns: Supported_Payment_Systems_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Supported_Payment_Systems_ManyArgs = {
  updates: Array<Supported_Payment_Systems_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_User_MessagesArgs = {
  _set?: InputMaybe<User_Messages_Set_Input>;
  where: User_Messages_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_User_Messages_By_PkArgs = {
  _set?: InputMaybe<User_Messages_Set_Input>;
  pk_columns: User_Messages_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_User_Messages_ManyArgs = {
  updates: Array<User_Messages_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_User_TypesArgs = {
  _set?: InputMaybe<User_Types_Set_Input>;
  where: User_Types_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_User_Types_By_PkArgs = {
  _set?: InputMaybe<User_Types_Set_Input>;
  pk_columns: User_Types_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_User_Types_ManyArgs = {
  updates: Array<User_Types_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_User_UploadsArgs = {
  _inc?: InputMaybe<User_Uploads_Inc_Input>;
  _set?: InputMaybe<User_Uploads_Set_Input>;
  where: User_Uploads_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_User_Uploads_By_PkArgs = {
  _inc?: InputMaybe<User_Uploads_Inc_Input>;
  _set?: InputMaybe<User_Uploads_Set_Input>;
  pk_columns: User_Uploads_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_User_Uploads_ManyArgs = {
  updates: Array<User_Uploads_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_UsersArgs = {
  _set?: InputMaybe<Users_Set_Input>;
  where: Users_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Users_By_PkArgs = {
  _set?: InputMaybe<Users_Set_Input>;
  pk_columns: Users_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Users_ManyArgs = {
  updates: Array<Users_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Vehicle_TypesArgs = {
  _set?: InputMaybe<Vehicle_Types_Set_Input>;
  where: Vehicle_Types_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Vehicle_Types_By_PkArgs = {
  _set?: InputMaybe<Vehicle_Types_Set_Input>;
  pk_columns: Vehicle_Types_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Vehicle_Types_ManyArgs = {
  updates: Array<Vehicle_Types_Updates>;
};

/** Boolean expression to compare columns of type "numeric". All fields are combined with logical 'AND'. */
export type Numeric_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['numeric']['input']>;
  _gt?: InputMaybe<Scalars['numeric']['input']>;
  _gte?: InputMaybe<Scalars['numeric']['input']>;
  _in?: InputMaybe<Array<Scalars['numeric']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['numeric']['input']>;
  _lte?: InputMaybe<Scalars['numeric']['input']>;
  _neq?: InputMaybe<Scalars['numeric']['input']>;
  _nin?: InputMaybe<Array<Scalars['numeric']['input']>>;
};

/** column ordering options */
export enum Order_By {
  /** in ascending order, nulls last */
  Asc = 'asc',
  /** in ascending order, nulls first */
  AscNullsFirst = 'asc_nulls_first',
  /** in ascending order, nulls last */
  AscNullsLast = 'asc_nulls_last',
  /** in descending order, nulls first */
  Desc = 'desc',
  /** in descending order, nulls first */
  DescNullsFirst = 'desc_nulls_first',
  /** in descending order, nulls last */
  DescNullsLast = 'desc_nulls_last'
}

/** Predefined list of order cancellation reasons */
export type Order_Cancellation_Reasons = {
  __typename?: 'order_cancellation_reasons';
  created_at: Scalars['timestamptz']['output'];
  display: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  /** Personas that can use this cancellation reason (client, business, agent) */
  persona: Array<Scalars['String']['output']>;
  rank: Scalars['Int']['output'];
  updated_at: Scalars['timestamptz']['output'];
  value: Scalars['String']['output'];
};

/** aggregated selection of "order_cancellation_reasons" */
export type Order_Cancellation_Reasons_Aggregate = {
  __typename?: 'order_cancellation_reasons_aggregate';
  aggregate?: Maybe<Order_Cancellation_Reasons_Aggregate_Fields>;
  nodes: Array<Order_Cancellation_Reasons>;
};

/** aggregate fields of "order_cancellation_reasons" */
export type Order_Cancellation_Reasons_Aggregate_Fields = {
  __typename?: 'order_cancellation_reasons_aggregate_fields';
  avg?: Maybe<Order_Cancellation_Reasons_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Order_Cancellation_Reasons_Max_Fields>;
  min?: Maybe<Order_Cancellation_Reasons_Min_Fields>;
  stddev?: Maybe<Order_Cancellation_Reasons_Stddev_Fields>;
  stddev_pop?: Maybe<Order_Cancellation_Reasons_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Order_Cancellation_Reasons_Stddev_Samp_Fields>;
  sum?: Maybe<Order_Cancellation_Reasons_Sum_Fields>;
  var_pop?: Maybe<Order_Cancellation_Reasons_Var_Pop_Fields>;
  var_samp?: Maybe<Order_Cancellation_Reasons_Var_Samp_Fields>;
  variance?: Maybe<Order_Cancellation_Reasons_Variance_Fields>;
};


/** aggregate fields of "order_cancellation_reasons" */
export type Order_Cancellation_Reasons_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Order_Cancellation_Reasons_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Order_Cancellation_Reasons_Avg_Fields = {
  __typename?: 'order_cancellation_reasons_avg_fields';
  id?: Maybe<Scalars['Float']['output']>;
  rank?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "order_cancellation_reasons". All fields are combined with a logical 'AND'. */
export type Order_Cancellation_Reasons_Bool_Exp = {
  _and?: InputMaybe<Array<Order_Cancellation_Reasons_Bool_Exp>>;
  _not?: InputMaybe<Order_Cancellation_Reasons_Bool_Exp>;
  _or?: InputMaybe<Array<Order_Cancellation_Reasons_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  display?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Int_Comparison_Exp>;
  persona?: InputMaybe<String_Array_Comparison_Exp>;
  rank?: InputMaybe<Int_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  value?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "order_cancellation_reasons" */
export enum Order_Cancellation_Reasons_Constraint {
  /** unique or primary key constraint on columns "id" */
  OrderCancellationReasonsPkey = 'order_cancellation_reasons_pkey',
  /** unique or primary key constraint on columns "value" */
  OrderCancellationReasonsValueKey = 'order_cancellation_reasons_value_key'
}

/** input type for incrementing numeric columns in table "order_cancellation_reasons" */
export type Order_Cancellation_Reasons_Inc_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
  rank?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "order_cancellation_reasons" */
export type Order_Cancellation_Reasons_Insert_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  display?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  /** Personas that can use this cancellation reason (client, business, agent) */
  persona?: InputMaybe<Array<Scalars['String']['input']>>;
  rank?: InputMaybe<Scalars['Int']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Order_Cancellation_Reasons_Max_Fields = {
  __typename?: 'order_cancellation_reasons_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  display?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  /** Personas that can use this cancellation reason (client, business, agent) */
  persona?: Maybe<Array<Scalars['String']['output']>>;
  rank?: Maybe<Scalars['Int']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Order_Cancellation_Reasons_Min_Fields = {
  __typename?: 'order_cancellation_reasons_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  display?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['Int']['output']>;
  /** Personas that can use this cancellation reason (client, business, agent) */
  persona?: Maybe<Array<Scalars['String']['output']>>;
  rank?: Maybe<Scalars['Int']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "order_cancellation_reasons" */
export type Order_Cancellation_Reasons_Mutation_Response = {
  __typename?: 'order_cancellation_reasons_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Order_Cancellation_Reasons>;
};

/** on_conflict condition type for table "order_cancellation_reasons" */
export type Order_Cancellation_Reasons_On_Conflict = {
  constraint: Order_Cancellation_Reasons_Constraint;
  update_columns?: Array<Order_Cancellation_Reasons_Update_Column>;
  where?: InputMaybe<Order_Cancellation_Reasons_Bool_Exp>;
};

/** Ordering options when selecting data from "order_cancellation_reasons". */
export type Order_Cancellation_Reasons_Order_By = {
  created_at?: InputMaybe<Order_By>;
  display?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  persona?: InputMaybe<Order_By>;
  rank?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
};

/** primary key columns input for table: order_cancellation_reasons */
export type Order_Cancellation_Reasons_Pk_Columns_Input = {
  id: Scalars['Int']['input'];
};

/** select columns of table "order_cancellation_reasons" */
export enum Order_Cancellation_Reasons_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Display = 'display',
  /** column name */
  Id = 'id',
  /** column name */
  Persona = 'persona',
  /** column name */
  Rank = 'rank',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  Value = 'value'
}

/** input type for updating data in table "order_cancellation_reasons" */
export type Order_Cancellation_Reasons_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  display?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  /** Personas that can use this cancellation reason (client, business, agent) */
  persona?: InputMaybe<Array<Scalars['String']['input']>>;
  rank?: InputMaybe<Scalars['Int']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Order_Cancellation_Reasons_Stddev_Fields = {
  __typename?: 'order_cancellation_reasons_stddev_fields';
  id?: Maybe<Scalars['Float']['output']>;
  rank?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Order_Cancellation_Reasons_Stddev_Pop_Fields = {
  __typename?: 'order_cancellation_reasons_stddev_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
  rank?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Order_Cancellation_Reasons_Stddev_Samp_Fields = {
  __typename?: 'order_cancellation_reasons_stddev_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
  rank?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "order_cancellation_reasons" */
export type Order_Cancellation_Reasons_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Order_Cancellation_Reasons_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Order_Cancellation_Reasons_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  display?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  /** Personas that can use this cancellation reason (client, business, agent) */
  persona?: InputMaybe<Array<Scalars['String']['input']>>;
  rank?: InputMaybe<Scalars['Int']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate sum on columns */
export type Order_Cancellation_Reasons_Sum_Fields = {
  __typename?: 'order_cancellation_reasons_sum_fields';
  id?: Maybe<Scalars['Int']['output']>;
  rank?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "order_cancellation_reasons" */
export enum Order_Cancellation_Reasons_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Display = 'display',
  /** column name */
  Id = 'id',
  /** column name */
  Persona = 'persona',
  /** column name */
  Rank = 'rank',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  Value = 'value'
}

export type Order_Cancellation_Reasons_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Order_Cancellation_Reasons_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Order_Cancellation_Reasons_Set_Input>;
  /** filter the rows which have to be updated */
  where: Order_Cancellation_Reasons_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Order_Cancellation_Reasons_Var_Pop_Fields = {
  __typename?: 'order_cancellation_reasons_var_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
  rank?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Order_Cancellation_Reasons_Var_Samp_Fields = {
  __typename?: 'order_cancellation_reasons_var_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
  rank?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Order_Cancellation_Reasons_Variance_Fields = {
  __typename?: 'order_cancellation_reasons_variance_fields';
  id?: Maybe<Scalars['Float']['output']>;
  rank?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to compare columns of type "order_hold_status_enum". All fields are combined with logical 'AND'. */
export type Order_Hold_Status_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['order_hold_status_enum']['input']>;
  _gt?: InputMaybe<Scalars['order_hold_status_enum']['input']>;
  _gte?: InputMaybe<Scalars['order_hold_status_enum']['input']>;
  _in?: InputMaybe<Array<Scalars['order_hold_status_enum']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['order_hold_status_enum']['input']>;
  _lte?: InputMaybe<Scalars['order_hold_status_enum']['input']>;
  _neq?: InputMaybe<Scalars['order_hold_status_enum']['input']>;
  _nin?: InputMaybe<Array<Scalars['order_hold_status_enum']['input']>>;
};

/** Tracks holds placed on client and agent accounts for orders */
export type Order_Holds = {
  __typename?: 'order_holds';
  /** An object relationship */
  agent?: Maybe<Agents>;
  /** Amount held from agent account for the order */
  agent_hold_amount: Scalars['numeric']['output'];
  agent_id?: Maybe<Scalars['uuid']['output']>;
  /** An object relationship */
  client: Clients;
  /** Amount held from client account for the order */
  client_hold_amount: Scalars['numeric']['output'];
  client_id: Scalars['uuid']['output'];
  created_at: Scalars['timestamptz']['output'];
  currency: Scalars['currency_enum']['output'];
  /** Amount of delivery fees held for this order */
  delivery_fees: Scalars['numeric']['output'];
  id: Scalars['uuid']['output'];
  /** An object relationship */
  order: Orders;
  order_id: Scalars['uuid']['output'];
  /** Current status of the hold (active, cancelled, completed) */
  status: Scalars['order_hold_status_enum']['output'];
  updated_at: Scalars['timestamptz']['output'];
};

/** aggregated selection of "order_holds" */
export type Order_Holds_Aggregate = {
  __typename?: 'order_holds_aggregate';
  aggregate?: Maybe<Order_Holds_Aggregate_Fields>;
  nodes: Array<Order_Holds>;
};

export type Order_Holds_Aggregate_Bool_Exp = {
  count?: InputMaybe<Order_Holds_Aggregate_Bool_Exp_Count>;
};

export type Order_Holds_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Order_Holds_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Order_Holds_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "order_holds" */
export type Order_Holds_Aggregate_Fields = {
  __typename?: 'order_holds_aggregate_fields';
  avg?: Maybe<Order_Holds_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Order_Holds_Max_Fields>;
  min?: Maybe<Order_Holds_Min_Fields>;
  stddev?: Maybe<Order_Holds_Stddev_Fields>;
  stddev_pop?: Maybe<Order_Holds_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Order_Holds_Stddev_Samp_Fields>;
  sum?: Maybe<Order_Holds_Sum_Fields>;
  var_pop?: Maybe<Order_Holds_Var_Pop_Fields>;
  var_samp?: Maybe<Order_Holds_Var_Samp_Fields>;
  variance?: Maybe<Order_Holds_Variance_Fields>;
};


/** aggregate fields of "order_holds" */
export type Order_Holds_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Order_Holds_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "order_holds" */
export type Order_Holds_Aggregate_Order_By = {
  avg?: InputMaybe<Order_Holds_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Order_Holds_Max_Order_By>;
  min?: InputMaybe<Order_Holds_Min_Order_By>;
  stddev?: InputMaybe<Order_Holds_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Order_Holds_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Order_Holds_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Order_Holds_Sum_Order_By>;
  var_pop?: InputMaybe<Order_Holds_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Order_Holds_Var_Samp_Order_By>;
  variance?: InputMaybe<Order_Holds_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "order_holds" */
export type Order_Holds_Arr_Rel_Insert_Input = {
  data: Array<Order_Holds_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Order_Holds_On_Conflict>;
};

/** aggregate avg on columns */
export type Order_Holds_Avg_Fields = {
  __typename?: 'order_holds_avg_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "order_holds" */
export type Order_Holds_Avg_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "order_holds". All fields are combined with a logical 'AND'. */
export type Order_Holds_Bool_Exp = {
  _and?: InputMaybe<Array<Order_Holds_Bool_Exp>>;
  _not?: InputMaybe<Order_Holds_Bool_Exp>;
  _or?: InputMaybe<Array<Order_Holds_Bool_Exp>>;
  agent?: InputMaybe<Agents_Bool_Exp>;
  agent_hold_amount?: InputMaybe<Numeric_Comparison_Exp>;
  agent_id?: InputMaybe<Uuid_Comparison_Exp>;
  client?: InputMaybe<Clients_Bool_Exp>;
  client_hold_amount?: InputMaybe<Numeric_Comparison_Exp>;
  client_id?: InputMaybe<Uuid_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<Currency_Enum_Comparison_Exp>;
  delivery_fees?: InputMaybe<Numeric_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  order?: InputMaybe<Orders_Bool_Exp>;
  order_id?: InputMaybe<Uuid_Comparison_Exp>;
  status?: InputMaybe<Order_Hold_Status_Enum_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "order_holds" */
export enum Order_Holds_Constraint {
  /** unique or primary key constraint on columns "id" */
  OrderHoldsPkey = 'order_holds_pkey',
  /** unique or primary key constraint on columns "order_id" */
  OrderHoldsUniqueOrder = 'order_holds_unique_order'
}

/** input type for incrementing numeric columns in table "order_holds" */
export type Order_Holds_Inc_Input = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Scalars['numeric']['input']>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Scalars['numeric']['input']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "order_holds" */
export type Order_Holds_Insert_Input = {
  agent?: InputMaybe<Agents_Obj_Rel_Insert_Input>;
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Scalars['numeric']['input']>;
  agent_id?: InputMaybe<Scalars['uuid']['input']>;
  client?: InputMaybe<Clients_Obj_Rel_Insert_Input>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Scalars['numeric']['input']>;
  client_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['currency_enum']['input']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  order?: InputMaybe<Orders_Obj_Rel_Insert_Input>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Current status of the hold (active, cancelled, completed) */
  status?: InputMaybe<Scalars['order_hold_status_enum']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Order_Holds_Max_Fields = {
  __typename?: 'order_holds_max_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['numeric']['output']>;
  agent_id?: Maybe<Scalars['uuid']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['numeric']['output']>;
  client_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['currency_enum']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  /** Current status of the hold (active, cancelled, completed) */
  status?: Maybe<Scalars['order_hold_status_enum']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "order_holds" */
export type Order_Holds_Max_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  agent_id?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  client_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  /** Current status of the hold (active, cancelled, completed) */
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Order_Holds_Min_Fields = {
  __typename?: 'order_holds_min_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['numeric']['output']>;
  agent_id?: Maybe<Scalars['uuid']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['numeric']['output']>;
  client_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['currency_enum']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  /** Current status of the hold (active, cancelled, completed) */
  status?: Maybe<Scalars['order_hold_status_enum']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "order_holds" */
export type Order_Holds_Min_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  agent_id?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  client_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  /** Current status of the hold (active, cancelled, completed) */
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "order_holds" */
export type Order_Holds_Mutation_Response = {
  __typename?: 'order_holds_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Order_Holds>;
};

/** input type for inserting object relation for remote table "order_holds" */
export type Order_Holds_Obj_Rel_Insert_Input = {
  data: Order_Holds_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Order_Holds_On_Conflict>;
};

/** on_conflict condition type for table "order_holds" */
export type Order_Holds_On_Conflict = {
  constraint: Order_Holds_Constraint;
  update_columns?: Array<Order_Holds_Update_Column>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};

/** Ordering options when selecting data from "order_holds". */
export type Order_Holds_Order_By = {
  agent?: InputMaybe<Agents_Order_By>;
  agent_hold_amount?: InputMaybe<Order_By>;
  agent_id?: InputMaybe<Order_By>;
  client?: InputMaybe<Clients_Order_By>;
  client_hold_amount?: InputMaybe<Order_By>;
  client_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  delivery_fees?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order?: InputMaybe<Orders_Order_By>;
  order_id?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: order_holds */
export type Order_Holds_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "order_holds" */
export enum Order_Holds_Select_Column {
  /** column name */
  AgentHoldAmount = 'agent_hold_amount',
  /** column name */
  AgentId = 'agent_id',
  /** column name */
  ClientHoldAmount = 'client_hold_amount',
  /** column name */
  ClientId = 'client_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  DeliveryFees = 'delivery_fees',
  /** column name */
  Id = 'id',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  Status = 'status',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "order_holds" */
export type Order_Holds_Set_Input = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Scalars['numeric']['input']>;
  agent_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Scalars['numeric']['input']>;
  client_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['currency_enum']['input']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Current status of the hold (active, cancelled, completed) */
  status?: InputMaybe<Scalars['order_hold_status_enum']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Order_Holds_Stddev_Fields = {
  __typename?: 'order_holds_stddev_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "order_holds" */
export type Order_Holds_Stddev_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Order_Holds_Stddev_Pop_Fields = {
  __typename?: 'order_holds_stddev_pop_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "order_holds" */
export type Order_Holds_Stddev_Pop_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Order_Holds_Stddev_Samp_Fields = {
  __typename?: 'order_holds_stddev_samp_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "order_holds" */
export type Order_Holds_Stddev_Samp_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "order_holds" */
export type Order_Holds_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Order_Holds_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Order_Holds_Stream_Cursor_Value_Input = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Scalars['numeric']['input']>;
  agent_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Scalars['numeric']['input']>;
  client_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['currency_enum']['input']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Current status of the hold (active, cancelled, completed) */
  status?: InputMaybe<Scalars['order_hold_status_enum']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Order_Holds_Sum_Fields = {
  __typename?: 'order_holds_sum_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['numeric']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['numeric']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "order_holds" */
export type Order_Holds_Sum_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
};

/** update columns of table "order_holds" */
export enum Order_Holds_Update_Column {
  /** column name */
  AgentHoldAmount = 'agent_hold_amount',
  /** column name */
  AgentId = 'agent_id',
  /** column name */
  ClientHoldAmount = 'client_hold_amount',
  /** column name */
  ClientId = 'client_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  DeliveryFees = 'delivery_fees',
  /** column name */
  Id = 'id',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  Status = 'status',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Order_Holds_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Order_Holds_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Order_Holds_Set_Input>;
  /** filter the rows which have to be updated */
  where: Order_Holds_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Order_Holds_Var_Pop_Fields = {
  __typename?: 'order_holds_var_pop_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "order_holds" */
export type Order_Holds_Var_Pop_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Order_Holds_Var_Samp_Fields = {
  __typename?: 'order_holds_var_samp_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "order_holds" */
export type Order_Holds_Var_Samp_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Order_Holds_Variance_Fields = {
  __typename?: 'order_holds_variance_fields';
  /** Amount held from agent account for the order */
  agent_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount held from client account for the order */
  client_hold_amount?: Maybe<Scalars['Float']['output']>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "order_holds" */
export type Order_Holds_Variance_Order_By = {
  /** Amount held from agent account for the order */
  agent_hold_amount?: InputMaybe<Order_By>;
  /** Amount held from client account for the order */
  client_hold_amount?: InputMaybe<Order_By>;
  /** Amount of delivery fees held for this order */
  delivery_fees?: InputMaybe<Order_By>;
};

/** columns and relationships of "order_items" */
export type Order_Items = {
  __typename?: 'order_items';
  /** An object relationship */
  business_inventory: Business_Inventory;
  business_inventory_id: Scalars['uuid']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  dimensions?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  /** An object relationship */
  item: Items;
  item_description?: Maybe<Scalars['String']['output']>;
  item_id: Scalars['uuid']['output'];
  item_name: Scalars['String']['output'];
  /** An object relationship */
  order: Orders;
  order_id: Scalars['uuid']['output'];
  quantity: Scalars['Int']['output'];
  special_instructions?: Maybe<Scalars['String']['output']>;
  total_price: Scalars['numeric']['output'];
  unit_price: Scalars['numeric']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
  weight_unit?: Maybe<Scalars['String']['output']>;
};

/** aggregated selection of "order_items" */
export type Order_Items_Aggregate = {
  __typename?: 'order_items_aggregate';
  aggregate?: Maybe<Order_Items_Aggregate_Fields>;
  nodes: Array<Order_Items>;
};

export type Order_Items_Aggregate_Bool_Exp = {
  count?: InputMaybe<Order_Items_Aggregate_Bool_Exp_Count>;
};

export type Order_Items_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Order_Items_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Order_Items_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "order_items" */
export type Order_Items_Aggregate_Fields = {
  __typename?: 'order_items_aggregate_fields';
  avg?: Maybe<Order_Items_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Order_Items_Max_Fields>;
  min?: Maybe<Order_Items_Min_Fields>;
  stddev?: Maybe<Order_Items_Stddev_Fields>;
  stddev_pop?: Maybe<Order_Items_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Order_Items_Stddev_Samp_Fields>;
  sum?: Maybe<Order_Items_Sum_Fields>;
  var_pop?: Maybe<Order_Items_Var_Pop_Fields>;
  var_samp?: Maybe<Order_Items_Var_Samp_Fields>;
  variance?: Maybe<Order_Items_Variance_Fields>;
};


/** aggregate fields of "order_items" */
export type Order_Items_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Order_Items_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "order_items" */
export type Order_Items_Aggregate_Order_By = {
  avg?: InputMaybe<Order_Items_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Order_Items_Max_Order_By>;
  min?: InputMaybe<Order_Items_Min_Order_By>;
  stddev?: InputMaybe<Order_Items_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Order_Items_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Order_Items_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Order_Items_Sum_Order_By>;
  var_pop?: InputMaybe<Order_Items_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Order_Items_Var_Samp_Order_By>;
  variance?: InputMaybe<Order_Items_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "order_items" */
export type Order_Items_Arr_Rel_Insert_Input = {
  data: Array<Order_Items_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Order_Items_On_Conflict>;
};

/** aggregate avg on columns */
export type Order_Items_Avg_Fields = {
  __typename?: 'order_items_avg_fields';
  quantity?: Maybe<Scalars['Float']['output']>;
  total_price?: Maybe<Scalars['Float']['output']>;
  unit_price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "order_items" */
export type Order_Items_Avg_Order_By = {
  quantity?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "order_items". All fields are combined with a logical 'AND'. */
export type Order_Items_Bool_Exp = {
  _and?: InputMaybe<Array<Order_Items_Bool_Exp>>;
  _not?: InputMaybe<Order_Items_Bool_Exp>;
  _or?: InputMaybe<Array<Order_Items_Bool_Exp>>;
  business_inventory?: InputMaybe<Business_Inventory_Bool_Exp>;
  business_inventory_id?: InputMaybe<Uuid_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  dimensions?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  item?: InputMaybe<Items_Bool_Exp>;
  item_description?: InputMaybe<String_Comparison_Exp>;
  item_id?: InputMaybe<Uuid_Comparison_Exp>;
  item_name?: InputMaybe<String_Comparison_Exp>;
  order?: InputMaybe<Orders_Bool_Exp>;
  order_id?: InputMaybe<Uuid_Comparison_Exp>;
  quantity?: InputMaybe<Int_Comparison_Exp>;
  special_instructions?: InputMaybe<String_Comparison_Exp>;
  total_price?: InputMaybe<Numeric_Comparison_Exp>;
  unit_price?: InputMaybe<Numeric_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  weight?: InputMaybe<Numeric_Comparison_Exp>;
  weight_unit?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "order_items" */
export enum Order_Items_Constraint {
  /** unique or primary key constraint on columns "id" */
  OrderItemsPkey = 'order_items_pkey'
}

/** input type for incrementing numeric columns in table "order_items" */
export type Order_Items_Inc_Input = {
  quantity?: InputMaybe<Scalars['Int']['input']>;
  total_price?: InputMaybe<Scalars['numeric']['input']>;
  unit_price?: InputMaybe<Scalars['numeric']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "order_items" */
export type Order_Items_Insert_Input = {
  business_inventory?: InputMaybe<Business_Inventory_Obj_Rel_Insert_Input>;
  business_inventory_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  dimensions?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  item?: InputMaybe<Items_Obj_Rel_Insert_Input>;
  item_description?: InputMaybe<Scalars['String']['input']>;
  item_id?: InputMaybe<Scalars['uuid']['input']>;
  item_name?: InputMaybe<Scalars['String']['input']>;
  order?: InputMaybe<Orders_Obj_Rel_Insert_Input>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  special_instructions?: InputMaybe<Scalars['String']['input']>;
  total_price?: InputMaybe<Scalars['numeric']['input']>;
  unit_price?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  weight_unit?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Order_Items_Max_Fields = {
  __typename?: 'order_items_max_fields';
  business_inventory_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  dimensions?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  item_description?: Maybe<Scalars['String']['output']>;
  item_id?: Maybe<Scalars['uuid']['output']>;
  item_name?: Maybe<Scalars['String']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
  special_instructions?: Maybe<Scalars['String']['output']>;
  total_price?: Maybe<Scalars['numeric']['output']>;
  unit_price?: Maybe<Scalars['numeric']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
  weight_unit?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "order_items" */
export type Order_Items_Max_Order_By = {
  business_inventory_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  dimensions?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_description?: InputMaybe<Order_By>;
  item_id?: InputMaybe<Order_By>;
  item_name?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  quantity?: InputMaybe<Order_By>;
  special_instructions?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  weight_unit?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Order_Items_Min_Fields = {
  __typename?: 'order_items_min_fields';
  business_inventory_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  dimensions?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  item_description?: Maybe<Scalars['String']['output']>;
  item_id?: Maybe<Scalars['uuid']['output']>;
  item_name?: Maybe<Scalars['String']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
  special_instructions?: Maybe<Scalars['String']['output']>;
  total_price?: Maybe<Scalars['numeric']['output']>;
  unit_price?: Maybe<Scalars['numeric']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
  weight_unit?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "order_items" */
export type Order_Items_Min_Order_By = {
  business_inventory_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  dimensions?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item_description?: InputMaybe<Order_By>;
  item_id?: InputMaybe<Order_By>;
  item_name?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  quantity?: InputMaybe<Order_By>;
  special_instructions?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  weight_unit?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "order_items" */
export type Order_Items_Mutation_Response = {
  __typename?: 'order_items_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Order_Items>;
};

/** on_conflict condition type for table "order_items" */
export type Order_Items_On_Conflict = {
  constraint: Order_Items_Constraint;
  update_columns?: Array<Order_Items_Update_Column>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};

/** Ordering options when selecting data from "order_items". */
export type Order_Items_Order_By = {
  business_inventory?: InputMaybe<Business_Inventory_Order_By>;
  business_inventory_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  dimensions?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  item?: InputMaybe<Items_Order_By>;
  item_description?: InputMaybe<Order_By>;
  item_id?: InputMaybe<Order_By>;
  item_name?: InputMaybe<Order_By>;
  order?: InputMaybe<Orders_Order_By>;
  order_id?: InputMaybe<Order_By>;
  quantity?: InputMaybe<Order_By>;
  special_instructions?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  weight_unit?: InputMaybe<Order_By>;
};

/** primary key columns input for table: order_items */
export type Order_Items_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "order_items" */
export enum Order_Items_Select_Column {
  /** column name */
  BusinessInventoryId = 'business_inventory_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Dimensions = 'dimensions',
  /** column name */
  Id = 'id',
  /** column name */
  ItemDescription = 'item_description',
  /** column name */
  ItemId = 'item_id',
  /** column name */
  ItemName = 'item_name',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  Quantity = 'quantity',
  /** column name */
  SpecialInstructions = 'special_instructions',
  /** column name */
  TotalPrice = 'total_price',
  /** column name */
  UnitPrice = 'unit_price',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  Weight = 'weight',
  /** column name */
  WeightUnit = 'weight_unit'
}

/** input type for updating data in table "order_items" */
export type Order_Items_Set_Input = {
  business_inventory_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  dimensions?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  item_description?: InputMaybe<Scalars['String']['input']>;
  item_id?: InputMaybe<Scalars['uuid']['input']>;
  item_name?: InputMaybe<Scalars['String']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  special_instructions?: InputMaybe<Scalars['String']['input']>;
  total_price?: InputMaybe<Scalars['numeric']['input']>;
  unit_price?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  weight_unit?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Order_Items_Stddev_Fields = {
  __typename?: 'order_items_stddev_fields';
  quantity?: Maybe<Scalars['Float']['output']>;
  total_price?: Maybe<Scalars['Float']['output']>;
  unit_price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "order_items" */
export type Order_Items_Stddev_Order_By = {
  quantity?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Order_Items_Stddev_Pop_Fields = {
  __typename?: 'order_items_stddev_pop_fields';
  quantity?: Maybe<Scalars['Float']['output']>;
  total_price?: Maybe<Scalars['Float']['output']>;
  unit_price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "order_items" */
export type Order_Items_Stddev_Pop_Order_By = {
  quantity?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Order_Items_Stddev_Samp_Fields = {
  __typename?: 'order_items_stddev_samp_fields';
  quantity?: Maybe<Scalars['Float']['output']>;
  total_price?: Maybe<Scalars['Float']['output']>;
  unit_price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "order_items" */
export type Order_Items_Stddev_Samp_Order_By = {
  quantity?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "order_items" */
export type Order_Items_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Order_Items_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Order_Items_Stream_Cursor_Value_Input = {
  business_inventory_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  dimensions?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  item_description?: InputMaybe<Scalars['String']['input']>;
  item_id?: InputMaybe<Scalars['uuid']['input']>;
  item_name?: InputMaybe<Scalars['String']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  special_instructions?: InputMaybe<Scalars['String']['input']>;
  total_price?: InputMaybe<Scalars['numeric']['input']>;
  unit_price?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  weight_unit?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate sum on columns */
export type Order_Items_Sum_Fields = {
  __typename?: 'order_items_sum_fields';
  quantity?: Maybe<Scalars['Int']['output']>;
  total_price?: Maybe<Scalars['numeric']['output']>;
  unit_price?: Maybe<Scalars['numeric']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "order_items" */
export type Order_Items_Sum_Order_By = {
  quantity?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** update columns of table "order_items" */
export enum Order_Items_Update_Column {
  /** column name */
  BusinessInventoryId = 'business_inventory_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Dimensions = 'dimensions',
  /** column name */
  Id = 'id',
  /** column name */
  ItemDescription = 'item_description',
  /** column name */
  ItemId = 'item_id',
  /** column name */
  ItemName = 'item_name',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  Quantity = 'quantity',
  /** column name */
  SpecialInstructions = 'special_instructions',
  /** column name */
  TotalPrice = 'total_price',
  /** column name */
  UnitPrice = 'unit_price',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  Weight = 'weight',
  /** column name */
  WeightUnit = 'weight_unit'
}

export type Order_Items_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Order_Items_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Order_Items_Set_Input>;
  /** filter the rows which have to be updated */
  where: Order_Items_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Order_Items_Var_Pop_Fields = {
  __typename?: 'order_items_var_pop_fields';
  quantity?: Maybe<Scalars['Float']['output']>;
  total_price?: Maybe<Scalars['Float']['output']>;
  unit_price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "order_items" */
export type Order_Items_Var_Pop_Order_By = {
  quantity?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Order_Items_Var_Samp_Fields = {
  __typename?: 'order_items_var_samp_fields';
  quantity?: Maybe<Scalars['Float']['output']>;
  total_price?: Maybe<Scalars['Float']['output']>;
  unit_price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "order_items" */
export type Order_Items_Var_Samp_Order_By = {
  quantity?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Order_Items_Variance_Fields = {
  __typename?: 'order_items_variance_fields';
  quantity?: Maybe<Scalars['Float']['output']>;
  total_price?: Maybe<Scalars['Float']['output']>;
  unit_price?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "order_items" */
export type Order_Items_Variance_Order_By = {
  quantity?: InputMaybe<Order_By>;
  total_price?: InputMaybe<Order_By>;
  unit_price?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** Boolean expression to compare columns of type "order_status". All fields are combined with logical 'AND'. */
export type Order_Status_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['order_status']['input']>;
  _gt?: InputMaybe<Scalars['order_status']['input']>;
  _gte?: InputMaybe<Scalars['order_status']['input']>;
  _in?: InputMaybe<Array<Scalars['order_status']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['order_status']['input']>;
  _lte?: InputMaybe<Scalars['order_status']['input']>;
  _neq?: InputMaybe<Scalars['order_status']['input']>;
  _nin?: InputMaybe<Array<Scalars['order_status']['input']>>;
};

/** columns and relationships of "order_status_history" */
export type Order_Status_History = {
  __typename?: 'order_status_history';
  changed_by_type: Scalars['String']['output'];
  /** An object relationship */
  changed_by_user?: Maybe<Users>;
  changed_by_user_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id: Scalars['uuid']['output'];
  location_address?: Maybe<Scalars['String']['output']>;
  location_lat?: Maybe<Scalars['numeric']['output']>;
  location_lng?: Maybe<Scalars['numeric']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  /** An object relationship */
  order: Orders;
  order_id: Scalars['uuid']['output'];
  previous_status?: Maybe<Scalars['order_status']['output']>;
  status: Scalars['order_status']['output'];
};

/** aggregated selection of "order_status_history" */
export type Order_Status_History_Aggregate = {
  __typename?: 'order_status_history_aggregate';
  aggregate?: Maybe<Order_Status_History_Aggregate_Fields>;
  nodes: Array<Order_Status_History>;
};

export type Order_Status_History_Aggregate_Bool_Exp = {
  count?: InputMaybe<Order_Status_History_Aggregate_Bool_Exp_Count>;
};

export type Order_Status_History_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Order_Status_History_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "order_status_history" */
export type Order_Status_History_Aggregate_Fields = {
  __typename?: 'order_status_history_aggregate_fields';
  avg?: Maybe<Order_Status_History_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Order_Status_History_Max_Fields>;
  min?: Maybe<Order_Status_History_Min_Fields>;
  stddev?: Maybe<Order_Status_History_Stddev_Fields>;
  stddev_pop?: Maybe<Order_Status_History_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Order_Status_History_Stddev_Samp_Fields>;
  sum?: Maybe<Order_Status_History_Sum_Fields>;
  var_pop?: Maybe<Order_Status_History_Var_Pop_Fields>;
  var_samp?: Maybe<Order_Status_History_Var_Samp_Fields>;
  variance?: Maybe<Order_Status_History_Variance_Fields>;
};


/** aggregate fields of "order_status_history" */
export type Order_Status_History_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "order_status_history" */
export type Order_Status_History_Aggregate_Order_By = {
  avg?: InputMaybe<Order_Status_History_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Order_Status_History_Max_Order_By>;
  min?: InputMaybe<Order_Status_History_Min_Order_By>;
  stddev?: InputMaybe<Order_Status_History_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Order_Status_History_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Order_Status_History_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Order_Status_History_Sum_Order_By>;
  var_pop?: InputMaybe<Order_Status_History_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Order_Status_History_Var_Samp_Order_By>;
  variance?: InputMaybe<Order_Status_History_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "order_status_history" */
export type Order_Status_History_Arr_Rel_Insert_Input = {
  data: Array<Order_Status_History_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Order_Status_History_On_Conflict>;
};

/** aggregate avg on columns */
export type Order_Status_History_Avg_Fields = {
  __typename?: 'order_status_history_avg_fields';
  location_lat?: Maybe<Scalars['Float']['output']>;
  location_lng?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "order_status_history" */
export type Order_Status_History_Avg_Order_By = {
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "order_status_history". All fields are combined with a logical 'AND'. */
export type Order_Status_History_Bool_Exp = {
  _and?: InputMaybe<Array<Order_Status_History_Bool_Exp>>;
  _not?: InputMaybe<Order_Status_History_Bool_Exp>;
  _or?: InputMaybe<Array<Order_Status_History_Bool_Exp>>;
  changed_by_type?: InputMaybe<String_Comparison_Exp>;
  changed_by_user?: InputMaybe<Users_Bool_Exp>;
  changed_by_user_id?: InputMaybe<Uuid_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  location_address?: InputMaybe<String_Comparison_Exp>;
  location_lat?: InputMaybe<Numeric_Comparison_Exp>;
  location_lng?: InputMaybe<Numeric_Comparison_Exp>;
  notes?: InputMaybe<String_Comparison_Exp>;
  order?: InputMaybe<Orders_Bool_Exp>;
  order_id?: InputMaybe<Uuid_Comparison_Exp>;
  previous_status?: InputMaybe<Order_Status_Comparison_Exp>;
  status?: InputMaybe<Order_Status_Comparison_Exp>;
};

/** unique or primary key constraints on table "order_status_history" */
export enum Order_Status_History_Constraint {
  /** unique or primary key constraint on columns "id" */
  OrderStatusHistoryPkey = 'order_status_history_pkey'
}

/** input type for incrementing numeric columns in table "order_status_history" */
export type Order_Status_History_Inc_Input = {
  location_lat?: InputMaybe<Scalars['numeric']['input']>;
  location_lng?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "order_status_history" */
export type Order_Status_History_Insert_Input = {
  changed_by_type?: InputMaybe<Scalars['String']['input']>;
  changed_by_user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  changed_by_user_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  location_address?: InputMaybe<Scalars['String']['input']>;
  location_lat?: InputMaybe<Scalars['numeric']['input']>;
  location_lng?: InputMaybe<Scalars['numeric']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  order?: InputMaybe<Orders_Obj_Rel_Insert_Input>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  previous_status?: InputMaybe<Scalars['order_status']['input']>;
  status?: InputMaybe<Scalars['order_status']['input']>;
};

/** aggregate max on columns */
export type Order_Status_History_Max_Fields = {
  __typename?: 'order_status_history_max_fields';
  changed_by_type?: Maybe<Scalars['String']['output']>;
  changed_by_user_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  location_address?: Maybe<Scalars['String']['output']>;
  location_lat?: Maybe<Scalars['numeric']['output']>;
  location_lng?: Maybe<Scalars['numeric']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  previous_status?: Maybe<Scalars['order_status']['output']>;
  status?: Maybe<Scalars['order_status']['output']>;
};

/** order by max() on columns of table "order_status_history" */
export type Order_Status_History_Max_Order_By = {
  changed_by_type?: InputMaybe<Order_By>;
  changed_by_user_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  location_address?: InputMaybe<Order_By>;
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  previous_status?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Order_Status_History_Min_Fields = {
  __typename?: 'order_status_history_min_fields';
  changed_by_type?: Maybe<Scalars['String']['output']>;
  changed_by_user_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  location_address?: Maybe<Scalars['String']['output']>;
  location_lat?: Maybe<Scalars['numeric']['output']>;
  location_lng?: Maybe<Scalars['numeric']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  previous_status?: Maybe<Scalars['order_status']['output']>;
  status?: Maybe<Scalars['order_status']['output']>;
};

/** order by min() on columns of table "order_status_history" */
export type Order_Status_History_Min_Order_By = {
  changed_by_type?: InputMaybe<Order_By>;
  changed_by_user_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  location_address?: InputMaybe<Order_By>;
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  previous_status?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "order_status_history" */
export type Order_Status_History_Mutation_Response = {
  __typename?: 'order_status_history_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Order_Status_History>;
};

/** on_conflict condition type for table "order_status_history" */
export type Order_Status_History_On_Conflict = {
  constraint: Order_Status_History_Constraint;
  update_columns?: Array<Order_Status_History_Update_Column>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};

/** Ordering options when selecting data from "order_status_history". */
export type Order_Status_History_Order_By = {
  changed_by_type?: InputMaybe<Order_By>;
  changed_by_user?: InputMaybe<Users_Order_By>;
  changed_by_user_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  location_address?: InputMaybe<Order_By>;
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  order?: InputMaybe<Orders_Order_By>;
  order_id?: InputMaybe<Order_By>;
  previous_status?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
};

/** primary key columns input for table: order_status_history */
export type Order_Status_History_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "order_status_history" */
export enum Order_Status_History_Select_Column {
  /** column name */
  ChangedByType = 'changed_by_type',
  /** column name */
  ChangedByUserId = 'changed_by_user_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  LocationAddress = 'location_address',
  /** column name */
  LocationLat = 'location_lat',
  /** column name */
  LocationLng = 'location_lng',
  /** column name */
  Notes = 'notes',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  PreviousStatus = 'previous_status',
  /** column name */
  Status = 'status'
}

/** input type for updating data in table "order_status_history" */
export type Order_Status_History_Set_Input = {
  changed_by_type?: InputMaybe<Scalars['String']['input']>;
  changed_by_user_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  location_address?: InputMaybe<Scalars['String']['input']>;
  location_lat?: InputMaybe<Scalars['numeric']['input']>;
  location_lng?: InputMaybe<Scalars['numeric']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  previous_status?: InputMaybe<Scalars['order_status']['input']>;
  status?: InputMaybe<Scalars['order_status']['input']>;
};

/** aggregate stddev on columns */
export type Order_Status_History_Stddev_Fields = {
  __typename?: 'order_status_history_stddev_fields';
  location_lat?: Maybe<Scalars['Float']['output']>;
  location_lng?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "order_status_history" */
export type Order_Status_History_Stddev_Order_By = {
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Order_Status_History_Stddev_Pop_Fields = {
  __typename?: 'order_status_history_stddev_pop_fields';
  location_lat?: Maybe<Scalars['Float']['output']>;
  location_lng?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "order_status_history" */
export type Order_Status_History_Stddev_Pop_Order_By = {
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Order_Status_History_Stddev_Samp_Fields = {
  __typename?: 'order_status_history_stddev_samp_fields';
  location_lat?: Maybe<Scalars['Float']['output']>;
  location_lng?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "order_status_history" */
export type Order_Status_History_Stddev_Samp_Order_By = {
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "order_status_history" */
export type Order_Status_History_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Order_Status_History_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Order_Status_History_Stream_Cursor_Value_Input = {
  changed_by_type?: InputMaybe<Scalars['String']['input']>;
  changed_by_user_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  location_address?: InputMaybe<Scalars['String']['input']>;
  location_lat?: InputMaybe<Scalars['numeric']['input']>;
  location_lng?: InputMaybe<Scalars['numeric']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  previous_status?: InputMaybe<Scalars['order_status']['input']>;
  status?: InputMaybe<Scalars['order_status']['input']>;
};

/** aggregate sum on columns */
export type Order_Status_History_Sum_Fields = {
  __typename?: 'order_status_history_sum_fields';
  location_lat?: Maybe<Scalars['numeric']['output']>;
  location_lng?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "order_status_history" */
export type Order_Status_History_Sum_Order_By = {
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
};

/** update columns of table "order_status_history" */
export enum Order_Status_History_Update_Column {
  /** column name */
  ChangedByType = 'changed_by_type',
  /** column name */
  ChangedByUserId = 'changed_by_user_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  LocationAddress = 'location_address',
  /** column name */
  LocationLat = 'location_lat',
  /** column name */
  LocationLng = 'location_lng',
  /** column name */
  Notes = 'notes',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  PreviousStatus = 'previous_status',
  /** column name */
  Status = 'status'
}

export type Order_Status_History_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Order_Status_History_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Order_Status_History_Set_Input>;
  /** filter the rows which have to be updated */
  where: Order_Status_History_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Order_Status_History_Var_Pop_Fields = {
  __typename?: 'order_status_history_var_pop_fields';
  location_lat?: Maybe<Scalars['Float']['output']>;
  location_lng?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "order_status_history" */
export type Order_Status_History_Var_Pop_Order_By = {
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Order_Status_History_Var_Samp_Fields = {
  __typename?: 'order_status_history_var_samp_fields';
  location_lat?: Maybe<Scalars['Float']['output']>;
  location_lng?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "order_status_history" */
export type Order_Status_History_Var_Samp_Order_By = {
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Order_Status_History_Variance_Fields = {
  __typename?: 'order_status_history_variance_fields';
  location_lat?: Maybe<Scalars['Float']['output']>;
  location_lng?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "order_status_history" */
export type Order_Status_History_Variance_Order_By = {
  location_lat?: InputMaybe<Order_By>;
  location_lng?: InputMaybe<Order_By>;
};

/** columns and relationships of "orders" */
export type Orders = {
  __typename?: 'orders';
  actual_delivery_time?: Maybe<Scalars['timestamptz']['output']>;
  /** An object relationship */
  assigned_agent?: Maybe<Agents>;
  assigned_agent_id?: Maybe<Scalars['uuid']['output']>;
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee: Scalars['numeric']['output'];
  /** An object relationship */
  business: Businesses;
  business_id: Scalars['uuid']['output'];
  /** An object relationship */
  business_location: Business_Locations;
  business_location_id: Scalars['uuid']['output'];
  /** An object relationship */
  client: Clients;
  client_id: Scalars['uuid']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency: Scalars['String']['output'];
  current_status: Scalars['order_status']['output'];
  /** An object relationship */
  delivery_address: Addresses;
  delivery_address_id: Scalars['uuid']['output'];
  /** An object relationship */
  delivery_time_window?: Maybe<Delivery_Time_Windows>;
  /** Reference to client preferred delivery time window */
  delivery_time_window_id?: Maybe<Scalars['uuid']['output']>;
  /** An array relationship */
  delivery_time_windows: Array<Delivery_Time_Windows>;
  /** An aggregate relationship */
  delivery_time_windows_aggregate: Delivery_Time_Windows_Aggregate;
  estimated_delivery_time?: Maybe<Scalars['timestamptz']['output']>;
  id: Scalars['uuid']['output'];
  /** An object relationship */
  order_hold?: Maybe<Order_Holds>;
  /** An array relationship */
  order_holds: Array<Order_Holds>;
  /** An aggregate relationship */
  order_holds_aggregate: Order_Holds_Aggregate;
  /** An array relationship */
  order_items: Array<Order_Items>;
  /** An aggregate relationship */
  order_items_aggregate: Order_Items_Aggregate;
  order_number: Scalars['String']['output'];
  /** An array relationship */
  order_status_history: Array<Order_Status_History>;
  /** An aggregate relationship */
  order_status_history_aggregate: Order_Status_History_Aggregate;
  payment_method?: Maybe<Scalars['String']['output']>;
  payment_status?: Maybe<Scalars['String']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee: Scalars['numeric']['output'];
  preferred_delivery_time?: Maybe<Scalars['timestamptz']['output']>;
  /** An array relationship */
  ratings: Array<Ratings>;
  /** An aggregate relationship */
  ratings_aggregate: Ratings_Aggregate;
  /** Indicates whether this order requires expedited/fast delivery service (typically 2-4 hours) */
  requires_fast_delivery: Scalars['Boolean']['output'];
  special_instructions?: Maybe<Scalars['String']['output']>;
  subtotal: Scalars['numeric']['output'];
  tax_amount: Scalars['numeric']['output'];
  total_amount: Scalars['numeric']['output'];
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  /** When true, only verified agents can pick up this order */
  verified_agent_delivery?: Maybe<Scalars['Boolean']['output']>;
};


/** columns and relationships of "orders" */
export type OrdersDelivery_Time_WindowsArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


/** columns and relationships of "orders" */
export type OrdersDelivery_Time_Windows_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


/** columns and relationships of "orders" */
export type OrdersOrder_HoldsArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


/** columns and relationships of "orders" */
export type OrdersOrder_Holds_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


/** columns and relationships of "orders" */
export type OrdersOrder_ItemsArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


/** columns and relationships of "orders" */
export type OrdersOrder_Items_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


/** columns and relationships of "orders" */
export type OrdersOrder_Status_HistoryArgs = {
  distinct_on?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Status_History_Order_By>>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};


/** columns and relationships of "orders" */
export type OrdersOrder_Status_History_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Status_History_Order_By>>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};


/** columns and relationships of "orders" */
export type OrdersRatingsArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


/** columns and relationships of "orders" */
export type OrdersRatings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};

/** aggregated selection of "orders" */
export type Orders_Aggregate = {
  __typename?: 'orders_aggregate';
  aggregate?: Maybe<Orders_Aggregate_Fields>;
  nodes: Array<Orders>;
};

export type Orders_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Orders_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Orders_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Orders_Aggregate_Bool_Exp_Count>;
};

export type Orders_Aggregate_Bool_Exp_Bool_And = {
  arguments: Orders_Select_Column_Orders_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Orders_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Orders_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Orders_Select_Column_Orders_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Orders_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Orders_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Orders_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Orders_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "orders" */
export type Orders_Aggregate_Fields = {
  __typename?: 'orders_aggregate_fields';
  avg?: Maybe<Orders_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Orders_Max_Fields>;
  min?: Maybe<Orders_Min_Fields>;
  stddev?: Maybe<Orders_Stddev_Fields>;
  stddev_pop?: Maybe<Orders_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Orders_Stddev_Samp_Fields>;
  sum?: Maybe<Orders_Sum_Fields>;
  var_pop?: Maybe<Orders_Var_Pop_Fields>;
  var_samp?: Maybe<Orders_Var_Samp_Fields>;
  variance?: Maybe<Orders_Variance_Fields>;
};


/** aggregate fields of "orders" */
export type Orders_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Orders_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "orders" */
export type Orders_Aggregate_Order_By = {
  avg?: InputMaybe<Orders_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Orders_Max_Order_By>;
  min?: InputMaybe<Orders_Min_Order_By>;
  stddev?: InputMaybe<Orders_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Orders_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Orders_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Orders_Sum_Order_By>;
  var_pop?: InputMaybe<Orders_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Orders_Var_Samp_Order_By>;
  variance?: InputMaybe<Orders_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "orders" */
export type Orders_Arr_Rel_Insert_Input = {
  data: Array<Orders_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Orders_On_Conflict>;
};

/** aggregate avg on columns */
export type Orders_Avg_Fields = {
  __typename?: 'orders_avg_fields';
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['Float']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['Float']['output']>;
  subtotal?: Maybe<Scalars['Float']['output']>;
  tax_amount?: Maybe<Scalars['Float']['output']>;
  total_amount?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "orders" */
export type Orders_Avg_Order_By = {
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "orders". All fields are combined with a logical 'AND'. */
export type Orders_Bool_Exp = {
  _and?: InputMaybe<Array<Orders_Bool_Exp>>;
  _not?: InputMaybe<Orders_Bool_Exp>;
  _or?: InputMaybe<Array<Orders_Bool_Exp>>;
  actual_delivery_time?: InputMaybe<Timestamptz_Comparison_Exp>;
  assigned_agent?: InputMaybe<Agents_Bool_Exp>;
  assigned_agent_id?: InputMaybe<Uuid_Comparison_Exp>;
  base_delivery_fee?: InputMaybe<Numeric_Comparison_Exp>;
  business?: InputMaybe<Businesses_Bool_Exp>;
  business_id?: InputMaybe<Uuid_Comparison_Exp>;
  business_location?: InputMaybe<Business_Locations_Bool_Exp>;
  business_location_id?: InputMaybe<Uuid_Comparison_Exp>;
  client?: InputMaybe<Clients_Bool_Exp>;
  client_id?: InputMaybe<Uuid_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  currency?: InputMaybe<String_Comparison_Exp>;
  current_status?: InputMaybe<Order_Status_Comparison_Exp>;
  delivery_address?: InputMaybe<Addresses_Bool_Exp>;
  delivery_address_id?: InputMaybe<Uuid_Comparison_Exp>;
  delivery_time_window?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
  delivery_time_window_id?: InputMaybe<Uuid_Comparison_Exp>;
  delivery_time_windows?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
  delivery_time_windows_aggregate?: InputMaybe<Delivery_Time_Windows_Aggregate_Bool_Exp>;
  estimated_delivery_time?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  order_hold?: InputMaybe<Order_Holds_Bool_Exp>;
  order_holds?: InputMaybe<Order_Holds_Bool_Exp>;
  order_holds_aggregate?: InputMaybe<Order_Holds_Aggregate_Bool_Exp>;
  order_items?: InputMaybe<Order_Items_Bool_Exp>;
  order_items_aggregate?: InputMaybe<Order_Items_Aggregate_Bool_Exp>;
  order_number?: InputMaybe<String_Comparison_Exp>;
  order_status_history?: InputMaybe<Order_Status_History_Bool_Exp>;
  order_status_history_aggregate?: InputMaybe<Order_Status_History_Aggregate_Bool_Exp>;
  payment_method?: InputMaybe<String_Comparison_Exp>;
  payment_status?: InputMaybe<String_Comparison_Exp>;
  per_km_delivery_fee?: InputMaybe<Numeric_Comparison_Exp>;
  preferred_delivery_time?: InputMaybe<Timestamptz_Comparison_Exp>;
  ratings?: InputMaybe<Ratings_Bool_Exp>;
  ratings_aggregate?: InputMaybe<Ratings_Aggregate_Bool_Exp>;
  requires_fast_delivery?: InputMaybe<Boolean_Comparison_Exp>;
  special_instructions?: InputMaybe<String_Comparison_Exp>;
  subtotal?: InputMaybe<Numeric_Comparison_Exp>;
  tax_amount?: InputMaybe<Numeric_Comparison_Exp>;
  total_amount?: InputMaybe<Numeric_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  verified_agent_delivery?: InputMaybe<Boolean_Comparison_Exp>;
};

/** unique or primary key constraints on table "orders" */
export enum Orders_Constraint {
  /** unique or primary key constraint on columns "order_number" */
  OrdersOrderNumberKey = 'orders_order_number_key',
  /** unique or primary key constraint on columns "id" */
  OrdersPkey = 'orders_pkey'
}

/** input type for incrementing numeric columns in table "orders" */
export type Orders_Inc_Input = {
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Scalars['numeric']['input']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Scalars['numeric']['input']>;
  subtotal?: InputMaybe<Scalars['numeric']['input']>;
  tax_amount?: InputMaybe<Scalars['numeric']['input']>;
  total_amount?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "orders" */
export type Orders_Insert_Input = {
  actual_delivery_time?: InputMaybe<Scalars['timestamptz']['input']>;
  assigned_agent?: InputMaybe<Agents_Obj_Rel_Insert_Input>;
  assigned_agent_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Scalars['numeric']['input']>;
  business?: InputMaybe<Businesses_Obj_Rel_Insert_Input>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  business_location?: InputMaybe<Business_Locations_Obj_Rel_Insert_Input>;
  business_location_id?: InputMaybe<Scalars['uuid']['input']>;
  client?: InputMaybe<Clients_Obj_Rel_Insert_Input>;
  client_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  current_status?: InputMaybe<Scalars['order_status']['input']>;
  delivery_address?: InputMaybe<Addresses_Obj_Rel_Insert_Input>;
  delivery_address_id?: InputMaybe<Scalars['uuid']['input']>;
  delivery_time_window?: InputMaybe<Delivery_Time_Windows_Obj_Rel_Insert_Input>;
  /** Reference to client preferred delivery time window */
  delivery_time_window_id?: InputMaybe<Scalars['uuid']['input']>;
  delivery_time_windows?: InputMaybe<Delivery_Time_Windows_Arr_Rel_Insert_Input>;
  estimated_delivery_time?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  order_hold?: InputMaybe<Order_Holds_Obj_Rel_Insert_Input>;
  order_holds?: InputMaybe<Order_Holds_Arr_Rel_Insert_Input>;
  order_items?: InputMaybe<Order_Items_Arr_Rel_Insert_Input>;
  order_number?: InputMaybe<Scalars['String']['input']>;
  order_status_history?: InputMaybe<Order_Status_History_Arr_Rel_Insert_Input>;
  payment_method?: InputMaybe<Scalars['String']['input']>;
  payment_status?: InputMaybe<Scalars['String']['input']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Scalars['numeric']['input']>;
  preferred_delivery_time?: InputMaybe<Scalars['timestamptz']['input']>;
  ratings?: InputMaybe<Ratings_Arr_Rel_Insert_Input>;
  /** Indicates whether this order requires expedited/fast delivery service (typically 2-4 hours) */
  requires_fast_delivery?: InputMaybe<Scalars['Boolean']['input']>;
  special_instructions?: InputMaybe<Scalars['String']['input']>;
  subtotal?: InputMaybe<Scalars['numeric']['input']>;
  tax_amount?: InputMaybe<Scalars['numeric']['input']>;
  total_amount?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  /** When true, only verified agents can pick up this order */
  verified_agent_delivery?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate max on columns */
export type Orders_Max_Fields = {
  __typename?: 'orders_max_fields';
  actual_delivery_time?: Maybe<Scalars['timestamptz']['output']>;
  assigned_agent_id?: Maybe<Scalars['uuid']['output']>;
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['numeric']['output']>;
  business_id?: Maybe<Scalars['uuid']['output']>;
  business_location_id?: Maybe<Scalars['uuid']['output']>;
  client_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  current_status?: Maybe<Scalars['order_status']['output']>;
  delivery_address_id?: Maybe<Scalars['uuid']['output']>;
  /** Reference to client preferred delivery time window */
  delivery_time_window_id?: Maybe<Scalars['uuid']['output']>;
  estimated_delivery_time?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  order_number?: Maybe<Scalars['String']['output']>;
  payment_method?: Maybe<Scalars['String']['output']>;
  payment_status?: Maybe<Scalars['String']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['numeric']['output']>;
  preferred_delivery_time?: Maybe<Scalars['timestamptz']['output']>;
  special_instructions?: Maybe<Scalars['String']['output']>;
  subtotal?: Maybe<Scalars['numeric']['output']>;
  tax_amount?: Maybe<Scalars['numeric']['output']>;
  total_amount?: Maybe<Scalars['numeric']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "orders" */
export type Orders_Max_Order_By = {
  actual_delivery_time?: InputMaybe<Order_By>;
  assigned_agent_id?: InputMaybe<Order_By>;
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  business_id?: InputMaybe<Order_By>;
  business_location_id?: InputMaybe<Order_By>;
  client_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  current_status?: InputMaybe<Order_By>;
  delivery_address_id?: InputMaybe<Order_By>;
  /** Reference to client preferred delivery time window */
  delivery_time_window_id?: InputMaybe<Order_By>;
  estimated_delivery_time?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_number?: InputMaybe<Order_By>;
  payment_method?: InputMaybe<Order_By>;
  payment_status?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  preferred_delivery_time?: InputMaybe<Order_By>;
  special_instructions?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Orders_Min_Fields = {
  __typename?: 'orders_min_fields';
  actual_delivery_time?: Maybe<Scalars['timestamptz']['output']>;
  assigned_agent_id?: Maybe<Scalars['uuid']['output']>;
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['numeric']['output']>;
  business_id?: Maybe<Scalars['uuid']['output']>;
  business_location_id?: Maybe<Scalars['uuid']['output']>;
  client_id?: Maybe<Scalars['uuid']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  current_status?: Maybe<Scalars['order_status']['output']>;
  delivery_address_id?: Maybe<Scalars['uuid']['output']>;
  /** Reference to client preferred delivery time window */
  delivery_time_window_id?: Maybe<Scalars['uuid']['output']>;
  estimated_delivery_time?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  order_number?: Maybe<Scalars['String']['output']>;
  payment_method?: Maybe<Scalars['String']['output']>;
  payment_status?: Maybe<Scalars['String']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['numeric']['output']>;
  preferred_delivery_time?: Maybe<Scalars['timestamptz']['output']>;
  special_instructions?: Maybe<Scalars['String']['output']>;
  subtotal?: Maybe<Scalars['numeric']['output']>;
  tax_amount?: Maybe<Scalars['numeric']['output']>;
  total_amount?: Maybe<Scalars['numeric']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "orders" */
export type Orders_Min_Order_By = {
  actual_delivery_time?: InputMaybe<Order_By>;
  assigned_agent_id?: InputMaybe<Order_By>;
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  business_id?: InputMaybe<Order_By>;
  business_location_id?: InputMaybe<Order_By>;
  client_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  current_status?: InputMaybe<Order_By>;
  delivery_address_id?: InputMaybe<Order_By>;
  /** Reference to client preferred delivery time window */
  delivery_time_window_id?: InputMaybe<Order_By>;
  estimated_delivery_time?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_number?: InputMaybe<Order_By>;
  payment_method?: InputMaybe<Order_By>;
  payment_status?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  preferred_delivery_time?: InputMaybe<Order_By>;
  special_instructions?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "orders" */
export type Orders_Mutation_Response = {
  __typename?: 'orders_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Orders>;
};

/** input type for inserting object relation for remote table "orders" */
export type Orders_Obj_Rel_Insert_Input = {
  data: Orders_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Orders_On_Conflict>;
};

/** on_conflict condition type for table "orders" */
export type Orders_On_Conflict = {
  constraint: Orders_Constraint;
  update_columns?: Array<Orders_Update_Column>;
  where?: InputMaybe<Orders_Bool_Exp>;
};

/** Ordering options when selecting data from "orders". */
export type Orders_Order_By = {
  actual_delivery_time?: InputMaybe<Order_By>;
  assigned_agent?: InputMaybe<Agents_Order_By>;
  assigned_agent_id?: InputMaybe<Order_By>;
  base_delivery_fee?: InputMaybe<Order_By>;
  business?: InputMaybe<Businesses_Order_By>;
  business_id?: InputMaybe<Order_By>;
  business_location?: InputMaybe<Business_Locations_Order_By>;
  business_location_id?: InputMaybe<Order_By>;
  client?: InputMaybe<Clients_Order_By>;
  client_id?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  currency?: InputMaybe<Order_By>;
  current_status?: InputMaybe<Order_By>;
  delivery_address?: InputMaybe<Addresses_Order_By>;
  delivery_address_id?: InputMaybe<Order_By>;
  delivery_time_window?: InputMaybe<Delivery_Time_Windows_Order_By>;
  delivery_time_window_id?: InputMaybe<Order_By>;
  delivery_time_windows_aggregate?: InputMaybe<Delivery_Time_Windows_Aggregate_Order_By>;
  estimated_delivery_time?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_hold?: InputMaybe<Order_Holds_Order_By>;
  order_holds_aggregate?: InputMaybe<Order_Holds_Aggregate_Order_By>;
  order_items_aggregate?: InputMaybe<Order_Items_Aggregate_Order_By>;
  order_number?: InputMaybe<Order_By>;
  order_status_history_aggregate?: InputMaybe<Order_Status_History_Aggregate_Order_By>;
  payment_method?: InputMaybe<Order_By>;
  payment_status?: InputMaybe<Order_By>;
  per_km_delivery_fee?: InputMaybe<Order_By>;
  preferred_delivery_time?: InputMaybe<Order_By>;
  ratings_aggregate?: InputMaybe<Ratings_Aggregate_Order_By>;
  requires_fast_delivery?: InputMaybe<Order_By>;
  special_instructions?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  verified_agent_delivery?: InputMaybe<Order_By>;
};

/** primary key columns input for table: orders */
export type Orders_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "orders" */
export enum Orders_Select_Column {
  /** column name */
  ActualDeliveryTime = 'actual_delivery_time',
  /** column name */
  AssignedAgentId = 'assigned_agent_id',
  /** column name */
  BaseDeliveryFee = 'base_delivery_fee',
  /** column name */
  BusinessId = 'business_id',
  /** column name */
  BusinessLocationId = 'business_location_id',
  /** column name */
  ClientId = 'client_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  CurrentStatus = 'current_status',
  /** column name */
  DeliveryAddressId = 'delivery_address_id',
  /** column name */
  DeliveryTimeWindowId = 'delivery_time_window_id',
  /** column name */
  EstimatedDeliveryTime = 'estimated_delivery_time',
  /** column name */
  Id = 'id',
  /** column name */
  OrderNumber = 'order_number',
  /** column name */
  PaymentMethod = 'payment_method',
  /** column name */
  PaymentStatus = 'payment_status',
  /** column name */
  PerKmDeliveryFee = 'per_km_delivery_fee',
  /** column name */
  PreferredDeliveryTime = 'preferred_delivery_time',
  /** column name */
  RequiresFastDelivery = 'requires_fast_delivery',
  /** column name */
  SpecialInstructions = 'special_instructions',
  /** column name */
  Subtotal = 'subtotal',
  /** column name */
  TaxAmount = 'tax_amount',
  /** column name */
  TotalAmount = 'total_amount',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  VerifiedAgentDelivery = 'verified_agent_delivery'
}

/** select "orders_aggregate_bool_exp_bool_and_arguments_columns" columns of table "orders" */
export enum Orders_Select_Column_Orders_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  RequiresFastDelivery = 'requires_fast_delivery',
  /** column name */
  VerifiedAgentDelivery = 'verified_agent_delivery'
}

/** select "orders_aggregate_bool_exp_bool_or_arguments_columns" columns of table "orders" */
export enum Orders_Select_Column_Orders_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  RequiresFastDelivery = 'requires_fast_delivery',
  /** column name */
  VerifiedAgentDelivery = 'verified_agent_delivery'
}

/** input type for updating data in table "orders" */
export type Orders_Set_Input = {
  actual_delivery_time?: InputMaybe<Scalars['timestamptz']['input']>;
  assigned_agent_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Scalars['numeric']['input']>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  business_location_id?: InputMaybe<Scalars['uuid']['input']>;
  client_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  current_status?: InputMaybe<Scalars['order_status']['input']>;
  delivery_address_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Reference to client preferred delivery time window */
  delivery_time_window_id?: InputMaybe<Scalars['uuid']['input']>;
  estimated_delivery_time?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  order_number?: InputMaybe<Scalars['String']['input']>;
  payment_method?: InputMaybe<Scalars['String']['input']>;
  payment_status?: InputMaybe<Scalars['String']['input']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Scalars['numeric']['input']>;
  preferred_delivery_time?: InputMaybe<Scalars['timestamptz']['input']>;
  /** Indicates whether this order requires expedited/fast delivery service (typically 2-4 hours) */
  requires_fast_delivery?: InputMaybe<Scalars['Boolean']['input']>;
  special_instructions?: InputMaybe<Scalars['String']['input']>;
  subtotal?: InputMaybe<Scalars['numeric']['input']>;
  tax_amount?: InputMaybe<Scalars['numeric']['input']>;
  total_amount?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  /** When true, only verified agents can pick up this order */
  verified_agent_delivery?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate stddev on columns */
export type Orders_Stddev_Fields = {
  __typename?: 'orders_stddev_fields';
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['Float']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['Float']['output']>;
  subtotal?: Maybe<Scalars['Float']['output']>;
  tax_amount?: Maybe<Scalars['Float']['output']>;
  total_amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "orders" */
export type Orders_Stddev_Order_By = {
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Orders_Stddev_Pop_Fields = {
  __typename?: 'orders_stddev_pop_fields';
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['Float']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['Float']['output']>;
  subtotal?: Maybe<Scalars['Float']['output']>;
  tax_amount?: Maybe<Scalars['Float']['output']>;
  total_amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "orders" */
export type Orders_Stddev_Pop_Order_By = {
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Orders_Stddev_Samp_Fields = {
  __typename?: 'orders_stddev_samp_fields';
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['Float']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['Float']['output']>;
  subtotal?: Maybe<Scalars['Float']['output']>;
  tax_amount?: Maybe<Scalars['Float']['output']>;
  total_amount?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "orders" */
export type Orders_Stddev_Samp_Order_By = {
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "orders" */
export type Orders_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Orders_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Orders_Stream_Cursor_Value_Input = {
  actual_delivery_time?: InputMaybe<Scalars['timestamptz']['input']>;
  assigned_agent_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Scalars['numeric']['input']>;
  business_id?: InputMaybe<Scalars['uuid']['input']>;
  business_location_id?: InputMaybe<Scalars['uuid']['input']>;
  client_id?: InputMaybe<Scalars['uuid']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  current_status?: InputMaybe<Scalars['order_status']['input']>;
  delivery_address_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Reference to client preferred delivery time window */
  delivery_time_window_id?: InputMaybe<Scalars['uuid']['input']>;
  estimated_delivery_time?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  order_number?: InputMaybe<Scalars['String']['input']>;
  payment_method?: InputMaybe<Scalars['String']['input']>;
  payment_status?: InputMaybe<Scalars['String']['input']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Scalars['numeric']['input']>;
  preferred_delivery_time?: InputMaybe<Scalars['timestamptz']['input']>;
  /** Indicates whether this order requires expedited/fast delivery service (typically 2-4 hours) */
  requires_fast_delivery?: InputMaybe<Scalars['Boolean']['input']>;
  special_instructions?: InputMaybe<Scalars['String']['input']>;
  subtotal?: InputMaybe<Scalars['numeric']['input']>;
  tax_amount?: InputMaybe<Scalars['numeric']['input']>;
  total_amount?: InputMaybe<Scalars['numeric']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  /** When true, only verified agents can pick up this order */
  verified_agent_delivery?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate sum on columns */
export type Orders_Sum_Fields = {
  __typename?: 'orders_sum_fields';
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['numeric']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['numeric']['output']>;
  subtotal?: Maybe<Scalars['numeric']['output']>;
  tax_amount?: Maybe<Scalars['numeric']['output']>;
  total_amount?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "orders" */
export type Orders_Sum_Order_By = {
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
};

/** update columns of table "orders" */
export enum Orders_Update_Column {
  /** column name */
  ActualDeliveryTime = 'actual_delivery_time',
  /** column name */
  AssignedAgentId = 'assigned_agent_id',
  /** column name */
  BaseDeliveryFee = 'base_delivery_fee',
  /** column name */
  BusinessId = 'business_id',
  /** column name */
  BusinessLocationId = 'business_location_id',
  /** column name */
  ClientId = 'client_id',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Currency = 'currency',
  /** column name */
  CurrentStatus = 'current_status',
  /** column name */
  DeliveryAddressId = 'delivery_address_id',
  /** column name */
  DeliveryTimeWindowId = 'delivery_time_window_id',
  /** column name */
  EstimatedDeliveryTime = 'estimated_delivery_time',
  /** column name */
  Id = 'id',
  /** column name */
  OrderNumber = 'order_number',
  /** column name */
  PaymentMethod = 'payment_method',
  /** column name */
  PaymentStatus = 'payment_status',
  /** column name */
  PerKmDeliveryFee = 'per_km_delivery_fee',
  /** column name */
  PreferredDeliveryTime = 'preferred_delivery_time',
  /** column name */
  RequiresFastDelivery = 'requires_fast_delivery',
  /** column name */
  SpecialInstructions = 'special_instructions',
  /** column name */
  Subtotal = 'subtotal',
  /** column name */
  TaxAmount = 'tax_amount',
  /** column name */
  TotalAmount = 'total_amount',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  VerifiedAgentDelivery = 'verified_agent_delivery'
}

export type Orders_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Orders_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Orders_Set_Input>;
  /** filter the rows which have to be updated */
  where: Orders_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Orders_Var_Pop_Fields = {
  __typename?: 'orders_var_pop_fields';
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['Float']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['Float']['output']>;
  subtotal?: Maybe<Scalars['Float']['output']>;
  tax_amount?: Maybe<Scalars['Float']['output']>;
  total_amount?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "orders" */
export type Orders_Var_Pop_Order_By = {
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Orders_Var_Samp_Fields = {
  __typename?: 'orders_var_samp_fields';
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['Float']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['Float']['output']>;
  subtotal?: Maybe<Scalars['Float']['output']>;
  tax_amount?: Maybe<Scalars['Float']['output']>;
  total_amount?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "orders" */
export type Orders_Var_Samp_Order_By = {
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Orders_Variance_Fields = {
  __typename?: 'orders_variance_fields';
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: Maybe<Scalars['Float']['output']>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: Maybe<Scalars['Float']['output']>;
  subtotal?: Maybe<Scalars['Float']['output']>;
  tax_amount?: Maybe<Scalars['Float']['output']>;
  total_amount?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "orders" */
export type Orders_Variance_Order_By = {
  /** Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config) */
  base_delivery_fee?: InputMaybe<Order_By>;
  /** Per-kilometer delivery fee calculated as (per_km_rate * distance) */
  per_km_delivery_fee?: InputMaybe<Order_By>;
  subtotal?: InputMaybe<Order_By>;
  tax_amount?: InputMaybe<Order_By>;
  total_amount?: InputMaybe<Order_By>;
};

/** columns and relationships of "payment_callbacks" */
export type Payment_Callbacks = {
  __typename?: 'payment_callbacks';
  callback_data: Scalars['jsonb']['output'];
  error_message?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  /** An object relationship */
  mobile_payment_transaction?: Maybe<Mobile_Payment_Transactions>;
  processed?: Maybe<Scalars['Boolean']['output']>;
  processed_at?: Maybe<Scalars['timestamptz']['output']>;
  received_at?: Maybe<Scalars['timestamptz']['output']>;
  transaction_id: Scalars['uuid']['output'];
};


/** columns and relationships of "payment_callbacks" */
export type Payment_CallbacksCallback_DataArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "payment_callbacks" */
export type Payment_Callbacks_Aggregate = {
  __typename?: 'payment_callbacks_aggregate';
  aggregate?: Maybe<Payment_Callbacks_Aggregate_Fields>;
  nodes: Array<Payment_Callbacks>;
};

export type Payment_Callbacks_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Payment_Callbacks_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Payment_Callbacks_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Payment_Callbacks_Aggregate_Bool_Exp_Count>;
};

export type Payment_Callbacks_Aggregate_Bool_Exp_Bool_And = {
  arguments: Payment_Callbacks_Select_Column_Payment_Callbacks_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Payment_Callbacks_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Payment_Callbacks_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Payment_Callbacks_Select_Column_Payment_Callbacks_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Payment_Callbacks_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Payment_Callbacks_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Payment_Callbacks_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Payment_Callbacks_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "payment_callbacks" */
export type Payment_Callbacks_Aggregate_Fields = {
  __typename?: 'payment_callbacks_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Payment_Callbacks_Max_Fields>;
  min?: Maybe<Payment_Callbacks_Min_Fields>;
};


/** aggregate fields of "payment_callbacks" */
export type Payment_Callbacks_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Payment_Callbacks_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "payment_callbacks" */
export type Payment_Callbacks_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Payment_Callbacks_Max_Order_By>;
  min?: InputMaybe<Payment_Callbacks_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Payment_Callbacks_Append_Input = {
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
};

/** input type for inserting array relation for remote table "payment_callbacks" */
export type Payment_Callbacks_Arr_Rel_Insert_Input = {
  data: Array<Payment_Callbacks_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Payment_Callbacks_On_Conflict>;
};

/** Boolean expression to filter rows from the table "payment_callbacks". All fields are combined with a logical 'AND'. */
export type Payment_Callbacks_Bool_Exp = {
  _and?: InputMaybe<Array<Payment_Callbacks_Bool_Exp>>;
  _not?: InputMaybe<Payment_Callbacks_Bool_Exp>;
  _or?: InputMaybe<Array<Payment_Callbacks_Bool_Exp>>;
  callback_data?: InputMaybe<Jsonb_Comparison_Exp>;
  error_message?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  mobile_payment_transaction?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
  processed?: InputMaybe<Boolean_Comparison_Exp>;
  processed_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  received_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  transaction_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "payment_callbacks" */
export enum Payment_Callbacks_Constraint {
  /** unique or primary key constraint on columns "id" */
  PaymentCallbacksPkey = 'payment_callbacks_pkey'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Payment_Callbacks_Delete_At_Path_Input = {
  callback_data?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Payment_Callbacks_Delete_Elem_Input = {
  callback_data?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Payment_Callbacks_Delete_Key_Input = {
  callback_data?: InputMaybe<Scalars['String']['input']>;
};

/** input type for inserting data into table "payment_callbacks" */
export type Payment_Callbacks_Insert_Input = {
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
  error_message?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  mobile_payment_transaction?: InputMaybe<Mobile_Payment_Transactions_Obj_Rel_Insert_Input>;
  processed?: InputMaybe<Scalars['Boolean']['input']>;
  processed_at?: InputMaybe<Scalars['timestamptz']['input']>;
  received_at?: InputMaybe<Scalars['timestamptz']['input']>;
  transaction_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type Payment_Callbacks_Max_Fields = {
  __typename?: 'payment_callbacks_max_fields';
  error_message?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  processed_at?: Maybe<Scalars['timestamptz']['output']>;
  received_at?: Maybe<Scalars['timestamptz']['output']>;
  transaction_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "payment_callbacks" */
export type Payment_Callbacks_Max_Order_By = {
  error_message?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  processed_at?: InputMaybe<Order_By>;
  received_at?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Payment_Callbacks_Min_Fields = {
  __typename?: 'payment_callbacks_min_fields';
  error_message?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  processed_at?: Maybe<Scalars['timestamptz']['output']>;
  received_at?: Maybe<Scalars['timestamptz']['output']>;
  transaction_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "payment_callbacks" */
export type Payment_Callbacks_Min_Order_By = {
  error_message?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  processed_at?: InputMaybe<Order_By>;
  received_at?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "payment_callbacks" */
export type Payment_Callbacks_Mutation_Response = {
  __typename?: 'payment_callbacks_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Payment_Callbacks>;
};

/** on_conflict condition type for table "payment_callbacks" */
export type Payment_Callbacks_On_Conflict = {
  constraint: Payment_Callbacks_Constraint;
  update_columns?: Array<Payment_Callbacks_Update_Column>;
  where?: InputMaybe<Payment_Callbacks_Bool_Exp>;
};

/** Ordering options when selecting data from "payment_callbacks". */
export type Payment_Callbacks_Order_By = {
  callback_data?: InputMaybe<Order_By>;
  error_message?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  mobile_payment_transaction?: InputMaybe<Mobile_Payment_Transactions_Order_By>;
  processed?: InputMaybe<Order_By>;
  processed_at?: InputMaybe<Order_By>;
  received_at?: InputMaybe<Order_By>;
  transaction_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: payment_callbacks */
export type Payment_Callbacks_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Payment_Callbacks_Prepend_Input = {
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "payment_callbacks" */
export enum Payment_Callbacks_Select_Column {
  /** column name */
  CallbackData = 'callback_data',
  /** column name */
  ErrorMessage = 'error_message',
  /** column name */
  Id = 'id',
  /** column name */
  Processed = 'processed',
  /** column name */
  ProcessedAt = 'processed_at',
  /** column name */
  ReceivedAt = 'received_at',
  /** column name */
  TransactionId = 'transaction_id'
}

/** select "payment_callbacks_aggregate_bool_exp_bool_and_arguments_columns" columns of table "payment_callbacks" */
export enum Payment_Callbacks_Select_Column_Payment_Callbacks_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  Processed = 'processed'
}

/** select "payment_callbacks_aggregate_bool_exp_bool_or_arguments_columns" columns of table "payment_callbacks" */
export enum Payment_Callbacks_Select_Column_Payment_Callbacks_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  Processed = 'processed'
}

/** input type for updating data in table "payment_callbacks" */
export type Payment_Callbacks_Set_Input = {
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
  error_message?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  processed?: InputMaybe<Scalars['Boolean']['input']>;
  processed_at?: InputMaybe<Scalars['timestamptz']['input']>;
  received_at?: InputMaybe<Scalars['timestamptz']['input']>;
  transaction_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** Streaming cursor of the table "payment_callbacks" */
export type Payment_Callbacks_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Payment_Callbacks_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Payment_Callbacks_Stream_Cursor_Value_Input = {
  callback_data?: InputMaybe<Scalars['jsonb']['input']>;
  error_message?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  processed?: InputMaybe<Scalars['Boolean']['input']>;
  processed_at?: InputMaybe<Scalars['timestamptz']['input']>;
  received_at?: InputMaybe<Scalars['timestamptz']['input']>;
  transaction_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "payment_callbacks" */
export enum Payment_Callbacks_Update_Column {
  /** column name */
  CallbackData = 'callback_data',
  /** column name */
  ErrorMessage = 'error_message',
  /** column name */
  Id = 'id',
  /** column name */
  Processed = 'processed',
  /** column name */
  ProcessedAt = 'processed_at',
  /** column name */
  ReceivedAt = 'received_at',
  /** column name */
  TransactionId = 'transaction_id'
}

export type Payment_Callbacks_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Payment_Callbacks_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Payment_Callbacks_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Payment_Callbacks_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Payment_Callbacks_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Payment_Callbacks_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Payment_Callbacks_Set_Input>;
  /** filter the rows which have to be updated */
  where: Payment_Callbacks_Bool_Exp;
};

/** Boolean expression to compare columns of type "payment_entity_type". All fields are combined with logical 'AND'. */
export type Payment_Entity_Type_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['payment_entity_type']['input']>;
  _gt?: InputMaybe<Scalars['payment_entity_type']['input']>;
  _gte?: InputMaybe<Scalars['payment_entity_type']['input']>;
  _in?: InputMaybe<Array<Scalars['payment_entity_type']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['payment_entity_type']['input']>;
  _lte?: InputMaybe<Scalars['payment_entity_type']['input']>;
  _neq?: InputMaybe<Scalars['payment_entity_type']['input']>;
  _nin?: InputMaybe<Array<Scalars['payment_entity_type']['input']>>;
};

export type Query_Root = {
  __typename?: 'query_root';
  /** An array relationship */
  account_transactions: Array<Account_Transactions>;
  /** An aggregate relationship */
  account_transactions_aggregate: Account_Transactions_Aggregate;
  /** fetch data from the table: "account_transactions" using primary key columns */
  account_transactions_by_pk?: Maybe<Account_Transactions>;
  /** An array relationship */
  accounts: Array<Accounts>;
  /** An aggregate relationship */
  accounts_aggregate: Accounts_Aggregate;
  /** fetch data from the table: "accounts" using primary key columns */
  accounts_by_pk?: Maybe<Accounts>;
  /** fetch data from the table: "addresses" */
  addresses: Array<Addresses>;
  /** fetch aggregated fields from the table: "addresses" */
  addresses_aggregate: Addresses_Aggregate;
  /** fetch data from the table: "addresses" using primary key columns */
  addresses_by_pk?: Maybe<Addresses>;
  /** An array relationship */
  agent_addresses: Array<Agent_Addresses>;
  /** An aggregate relationship */
  agent_addresses_aggregate: Agent_Addresses_Aggregate;
  /** fetch data from the table: "agent_addresses" using primary key columns */
  agent_addresses_by_pk?: Maybe<Agent_Addresses>;
  /** An array relationship */
  agents: Array<Agents>;
  /** An aggregate relationship */
  agents_aggregate: Agents_Aggregate;
  /** fetch data from the table: "agents" using primary key columns */
  agents_by_pk?: Maybe<Agents>;
  /** An array relationship */
  airtel_money_payments: Array<Airtel_Money_Payments>;
  /** An aggregate relationship */
  airtel_money_payments_aggregate: Airtel_Money_Payments_Aggregate;
  /** fetch data from the table: "airtel_money_payments" using primary key columns */
  airtel_money_payments_by_pk?: Maybe<Airtel_Money_Payments>;
  /** fetch data from the table: "application_configurations" */
  application_configurations: Array<Application_Configurations>;
  /** fetch aggregated fields from the table: "application_configurations" */
  application_configurations_aggregate: Application_Configurations_Aggregate;
  /** fetch data from the table: "application_configurations" using primary key columns */
  application_configurations_by_pk?: Maybe<Application_Configurations>;
  /** fetch data from the table: "brands" */
  brands: Array<Brands>;
  /** fetch aggregated fields from the table: "brands" */
  brands_aggregate: Brands_Aggregate;
  /** fetch data from the table: "brands" using primary key columns */
  brands_by_pk?: Maybe<Brands>;
  /** An array relationship */
  business_addresses: Array<Business_Addresses>;
  /** An aggregate relationship */
  business_addresses_aggregate: Business_Addresses_Aggregate;
  /** fetch data from the table: "business_addresses" using primary key columns */
  business_addresses_by_pk?: Maybe<Business_Addresses>;
  /** An array relationship */
  business_inventory: Array<Business_Inventory>;
  /** An aggregate relationship */
  business_inventory_aggregate: Business_Inventory_Aggregate;
  /** fetch data from the table: "business_inventory" using primary key columns */
  business_inventory_by_pk?: Maybe<Business_Inventory>;
  /** An array relationship */
  business_locations: Array<Business_Locations>;
  /** An aggregate relationship */
  business_locations_aggregate: Business_Locations_Aggregate;
  /** fetch data from the table: "business_locations" using primary key columns */
  business_locations_by_pk?: Maybe<Business_Locations>;
  /** fetch data from the table: "businesses" */
  businesses: Array<Businesses>;
  /** fetch aggregated fields from the table: "businesses" */
  businesses_aggregate: Businesses_Aggregate;
  /** fetch data from the table: "businesses" using primary key columns */
  businesses_by_pk?: Maybe<Businesses>;
  /** An array relationship */
  client_addresses: Array<Client_Addresses>;
  /** An aggregate relationship */
  client_addresses_aggregate: Client_Addresses_Aggregate;
  /** fetch data from the table: "client_addresses" using primary key columns */
  client_addresses_by_pk?: Maybe<Client_Addresses>;
  /** fetch data from the table: "clients" */
  clients: Array<Clients>;
  /** fetch aggregated fields from the table: "clients" */
  clients_aggregate: Clients_Aggregate;
  /** fetch data from the table: "clients" using primary key columns */
  clients_by_pk?: Maybe<Clients>;
  /** fetch data from the table: "delivery_fees" */
  delivery_fees: Array<Delivery_Fees>;
  /** fetch aggregated fields from the table: "delivery_fees" */
  delivery_fees_aggregate: Delivery_Fees_Aggregate;
  /** fetch data from the table: "delivery_fees" using primary key columns */
  delivery_fees_by_pk?: Maybe<Delivery_Fees>;
  /** fetch data from the table: "delivery_time_slots" */
  delivery_time_slots: Array<Delivery_Time_Slots>;
  /** fetch aggregated fields from the table: "delivery_time_slots" */
  delivery_time_slots_aggregate: Delivery_Time_Slots_Aggregate;
  /** fetch data from the table: "delivery_time_slots" using primary key columns */
  delivery_time_slots_by_pk?: Maybe<Delivery_Time_Slots>;
  /** An array relationship */
  delivery_time_windows: Array<Delivery_Time_Windows>;
  /** An aggregate relationship */
  delivery_time_windows_aggregate: Delivery_Time_Windows_Aggregate;
  /** fetch data from the table: "delivery_time_windows" using primary key columns */
  delivery_time_windows_by_pk?: Maybe<Delivery_Time_Windows>;
  /** fetch data from the table: "document_types" */
  document_types: Array<Document_Types>;
  /** fetch aggregated fields from the table: "document_types" */
  document_types_aggregate: Document_Types_Aggregate;
  /** fetch data from the table: "document_types" using primary key columns */
  document_types_by_pk?: Maybe<Document_Types>;
  /** fetch data from the table: "entity_types" */
  entity_types: Array<Entity_Types>;
  /** fetch aggregated fields from the table: "entity_types" */
  entity_types_aggregate: Entity_Types_Aggregate;
  /** fetch data from the table: "entity_types" using primary key columns */
  entity_types_by_pk?: Maybe<Entity_Types>;
  /** fetch data from the table: "google_distance_cache" */
  google_distance_cache: Array<Google_Distance_Cache>;
  /** fetch aggregated fields from the table: "google_distance_cache" */
  google_distance_cache_aggregate: Google_Distance_Cache_Aggregate;
  /** fetch data from the table: "google_distance_cache" using primary key columns */
  google_distance_cache_by_pk?: Maybe<Google_Distance_Cache>;
  /** fetch data from the table: "google_geocode_cache" */
  google_geocode_cache: Array<Google_Geocode_Cache>;
  /** fetch aggregated fields from the table: "google_geocode_cache" */
  google_geocode_cache_aggregate: Google_Geocode_Cache_Aggregate;
  /** fetch data from the table: "google_geocode_cache" using primary key columns */
  google_geocode_cache_by_pk?: Maybe<Google_Geocode_Cache>;
  /** fetch data from the table: "item_categories" */
  item_categories: Array<Item_Categories>;
  /** fetch aggregated fields from the table: "item_categories" */
  item_categories_aggregate: Item_Categories_Aggregate;
  /** fetch data from the table: "item_categories" using primary key columns */
  item_categories_by_pk?: Maybe<Item_Categories>;
  /** An array relationship */
  item_images: Array<Item_Images>;
  /** An aggregate relationship */
  item_images_aggregate: Item_Images_Aggregate;
  /** fetch data from the table: "item_images" using primary key columns */
  item_images_by_pk?: Maybe<Item_Images>;
  /** An array relationship */
  item_sub_categories: Array<Item_Sub_Categories>;
  /** An aggregate relationship */
  item_sub_categories_aggregate: Item_Sub_Categories_Aggregate;
  /** fetch data from the table: "item_sub_categories" using primary key columns */
  item_sub_categories_by_pk?: Maybe<Item_Sub_Categories>;
  /** An array relationship */
  items: Array<Items>;
  /** An aggregate relationship */
  items_aggregate: Items_Aggregate;
  /** fetch data from the table: "items" using primary key columns */
  items_by_pk?: Maybe<Items>;
  /** An array relationship */
  mobile_payment_transactions: Array<Mobile_Payment_Transactions>;
  /** An aggregate relationship */
  mobile_payment_transactions_aggregate: Mobile_Payment_Transactions_Aggregate;
  /** fetch data from the table: "mobile_payment_transactions" using primary key columns */
  mobile_payment_transactions_by_pk?: Maybe<Mobile_Payment_Transactions>;
  /** An array relationship */
  mtn_momo_payment_requests: Array<Mtn_Momo_Payment_Requests>;
  /** An aggregate relationship */
  mtn_momo_payment_requests_aggregate: Mtn_Momo_Payment_Requests_Aggregate;
  /** fetch data from the table: "mtn_momo_payment_requests" using primary key columns */
  mtn_momo_payment_requests_by_pk?: Maybe<Mtn_Momo_Payment_Requests>;
  /** fetch data from the table: "order_cancellation_reasons" */
  order_cancellation_reasons: Array<Order_Cancellation_Reasons>;
  /** fetch aggregated fields from the table: "order_cancellation_reasons" */
  order_cancellation_reasons_aggregate: Order_Cancellation_Reasons_Aggregate;
  /** fetch data from the table: "order_cancellation_reasons" using primary key columns */
  order_cancellation_reasons_by_pk?: Maybe<Order_Cancellation_Reasons>;
  /** An array relationship */
  order_holds: Array<Order_Holds>;
  /** An aggregate relationship */
  order_holds_aggregate: Order_Holds_Aggregate;
  /** fetch data from the table: "order_holds" using primary key columns */
  order_holds_by_pk?: Maybe<Order_Holds>;
  /** An array relationship */
  order_items: Array<Order_Items>;
  /** An aggregate relationship */
  order_items_aggregate: Order_Items_Aggregate;
  /** fetch data from the table: "order_items" using primary key columns */
  order_items_by_pk?: Maybe<Order_Items>;
  /** An array relationship */
  order_status_history: Array<Order_Status_History>;
  /** An aggregate relationship */
  order_status_history_aggregate: Order_Status_History_Aggregate;
  /** fetch data from the table: "order_status_history" using primary key columns */
  order_status_history_by_pk?: Maybe<Order_Status_History>;
  /** An array relationship */
  orders: Array<Orders>;
  /** An aggregate relationship */
  orders_aggregate: Orders_Aggregate;
  /** fetch data from the table: "orders" using primary key columns */
  orders_by_pk?: Maybe<Orders>;
  /** An array relationship */
  payment_callbacks: Array<Payment_Callbacks>;
  /** An aggregate relationship */
  payment_callbacks_aggregate: Payment_Callbacks_Aggregate;
  /** fetch data from the table: "payment_callbacks" using primary key columns */
  payment_callbacks_by_pk?: Maybe<Payment_Callbacks>;
  /** fetch data from the table: "rating_aggregates" */
  rating_aggregates: Array<Rating_Aggregates>;
  /** fetch aggregated fields from the table: "rating_aggregates" */
  rating_aggregates_aggregate: Rating_Aggregates_Aggregate;
  /** fetch data from the table: "rating_aggregates" using primary key columns */
  rating_aggregates_by_pk?: Maybe<Rating_Aggregates>;
  /** An array relationship */
  ratings: Array<Ratings>;
  /** An aggregate relationship */
  ratings_aggregate: Ratings_Aggregate;
  /** fetch data from the table: "ratings" using primary key columns */
  ratings_by_pk?: Maybe<Ratings>;
  /** fetch data from the table: "supported_payment_systems" */
  supported_payment_systems: Array<Supported_Payment_Systems>;
  /** fetch aggregated fields from the table: "supported_payment_systems" */
  supported_payment_systems_aggregate: Supported_Payment_Systems_Aggregate;
  /** fetch data from the table: "supported_payment_systems" using primary key columns */
  supported_payment_systems_by_pk?: Maybe<Supported_Payment_Systems>;
  /** An array relationship */
  user_messages: Array<User_Messages>;
  /** An aggregate relationship */
  user_messages_aggregate: User_Messages_Aggregate;
  /** fetch data from the table: "user_messages" using primary key columns */
  user_messages_by_pk?: Maybe<User_Messages>;
  /** fetch data from the table: "user_types" */
  user_types: Array<User_Types>;
  /** fetch aggregated fields from the table: "user_types" */
  user_types_aggregate: User_Types_Aggregate;
  /** fetch data from the table: "user_types" using primary key columns */
  user_types_by_pk?: Maybe<User_Types>;
  /** An array relationship */
  user_uploads: Array<User_Uploads>;
  /** An aggregate relationship */
  user_uploads_aggregate: User_Uploads_Aggregate;
  /** fetch data from the table: "user_uploads" using primary key columns */
  user_uploads_by_pk?: Maybe<User_Uploads>;
  /** An array relationship */
  users: Array<Users>;
  /** An aggregate relationship */
  users_aggregate: Users_Aggregate;
  /** fetch data from the table: "users" using primary key columns */
  users_by_pk?: Maybe<Users>;
  /** fetch data from the table: "vehicle_types" */
  vehicle_types: Array<Vehicle_Types>;
  /** fetch aggregated fields from the table: "vehicle_types" */
  vehicle_types_aggregate: Vehicle_Types_Aggregate;
  /** fetch data from the table: "vehicle_types" using primary key columns */
  vehicle_types_by_pk?: Maybe<Vehicle_Types>;
};


export type Query_RootAccount_TransactionsArgs = {
  distinct_on?: InputMaybe<Array<Account_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Account_Transactions_Order_By>>;
  where?: InputMaybe<Account_Transactions_Bool_Exp>;
};


export type Query_RootAccount_Transactions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Account_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Account_Transactions_Order_By>>;
  where?: InputMaybe<Account_Transactions_Bool_Exp>;
};


export type Query_RootAccount_Transactions_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootAccountsArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};


export type Query_RootAccounts_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};


export type Query_RootAccounts_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootAddressesArgs = {
  distinct_on?: InputMaybe<Array<Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Addresses_Order_By>>;
  where?: InputMaybe<Addresses_Bool_Exp>;
};


export type Query_RootAddresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Addresses_Order_By>>;
  where?: InputMaybe<Addresses_Bool_Exp>;
};


export type Query_RootAddresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootAgent_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agent_Addresses_Order_By>>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};


export type Query_RootAgent_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agent_Addresses_Order_By>>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};


export type Query_RootAgent_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootAgentsArgs = {
  distinct_on?: InputMaybe<Array<Agents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agents_Order_By>>;
  where?: InputMaybe<Agents_Bool_Exp>;
};


export type Query_RootAgents_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Agents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agents_Order_By>>;
  where?: InputMaybe<Agents_Bool_Exp>;
};


export type Query_RootAgents_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootAirtel_Money_PaymentsArgs = {
  distinct_on?: InputMaybe<Array<Airtel_Money_Payments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Airtel_Money_Payments_Order_By>>;
  where?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
};


export type Query_RootAirtel_Money_Payments_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Airtel_Money_Payments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Airtel_Money_Payments_Order_By>>;
  where?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
};


export type Query_RootAirtel_Money_Payments_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootApplication_ConfigurationsArgs = {
  distinct_on?: InputMaybe<Array<Application_Configurations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Application_Configurations_Order_By>>;
  where?: InputMaybe<Application_Configurations_Bool_Exp>;
};


export type Query_RootApplication_Configurations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Application_Configurations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Application_Configurations_Order_By>>;
  where?: InputMaybe<Application_Configurations_Bool_Exp>;
};


export type Query_RootApplication_Configurations_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootBrandsArgs = {
  distinct_on?: InputMaybe<Array<Brands_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Brands_Order_By>>;
  where?: InputMaybe<Brands_Bool_Exp>;
};


export type Query_RootBrands_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Brands_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Brands_Order_By>>;
  where?: InputMaybe<Brands_Bool_Exp>;
};


export type Query_RootBrands_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootBusiness_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Addresses_Order_By>>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};


export type Query_RootBusiness_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Addresses_Order_By>>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};


export type Query_RootBusiness_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootBusiness_InventoryArgs = {
  distinct_on?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Inventory_Order_By>>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};


export type Query_RootBusiness_Inventory_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Inventory_Order_By>>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};


export type Query_RootBusiness_Inventory_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootBusiness_LocationsArgs = {
  distinct_on?: InputMaybe<Array<Business_Locations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Locations_Order_By>>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};


export type Query_RootBusiness_Locations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Locations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Locations_Order_By>>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};


export type Query_RootBusiness_Locations_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootBusinessesArgs = {
  distinct_on?: InputMaybe<Array<Businesses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Businesses_Order_By>>;
  where?: InputMaybe<Businesses_Bool_Exp>;
};


export type Query_RootBusinesses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Businesses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Businesses_Order_By>>;
  where?: InputMaybe<Businesses_Bool_Exp>;
};


export type Query_RootBusinesses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootClient_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Client_Addresses_Order_By>>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};


export type Query_RootClient_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Client_Addresses_Order_By>>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};


export type Query_RootClient_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootClientsArgs = {
  distinct_on?: InputMaybe<Array<Clients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Clients_Order_By>>;
  where?: InputMaybe<Clients_Bool_Exp>;
};


export type Query_RootClients_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Clients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Clients_Order_By>>;
  where?: InputMaybe<Clients_Bool_Exp>;
};


export type Query_RootClients_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootDelivery_FeesArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Fees_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Fees_Order_By>>;
  where?: InputMaybe<Delivery_Fees_Bool_Exp>;
};


export type Query_RootDelivery_Fees_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Fees_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Fees_Order_By>>;
  where?: InputMaybe<Delivery_Fees_Bool_Exp>;
};


export type Query_RootDelivery_Fees_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootDelivery_Time_SlotsArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Slots_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Slots_Order_By>>;
  where?: InputMaybe<Delivery_Time_Slots_Bool_Exp>;
};


export type Query_RootDelivery_Time_Slots_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Slots_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Slots_Order_By>>;
  where?: InputMaybe<Delivery_Time_Slots_Bool_Exp>;
};


export type Query_RootDelivery_Time_Slots_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootDelivery_Time_WindowsArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


export type Query_RootDelivery_Time_Windows_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


export type Query_RootDelivery_Time_Windows_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootDocument_TypesArgs = {
  distinct_on?: InputMaybe<Array<Document_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Document_Types_Order_By>>;
  where?: InputMaybe<Document_Types_Bool_Exp>;
};


export type Query_RootDocument_Types_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Document_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Document_Types_Order_By>>;
  where?: InputMaybe<Document_Types_Bool_Exp>;
};


export type Query_RootDocument_Types_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Query_RootEntity_TypesArgs = {
  distinct_on?: InputMaybe<Array<Entity_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Entity_Types_Order_By>>;
  where?: InputMaybe<Entity_Types_Bool_Exp>;
};


export type Query_RootEntity_Types_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Entity_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Entity_Types_Order_By>>;
  where?: InputMaybe<Entity_Types_Bool_Exp>;
};


export type Query_RootEntity_Types_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootGoogle_Distance_CacheArgs = {
  distinct_on?: InputMaybe<Array<Google_Distance_Cache_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Google_Distance_Cache_Order_By>>;
  where?: InputMaybe<Google_Distance_Cache_Bool_Exp>;
};


export type Query_RootGoogle_Distance_Cache_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Google_Distance_Cache_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Google_Distance_Cache_Order_By>>;
  where?: InputMaybe<Google_Distance_Cache_Bool_Exp>;
};


export type Query_RootGoogle_Distance_Cache_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootGoogle_Geocode_CacheArgs = {
  distinct_on?: InputMaybe<Array<Google_Geocode_Cache_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Google_Geocode_Cache_Order_By>>;
  where?: InputMaybe<Google_Geocode_Cache_Bool_Exp>;
};


export type Query_RootGoogle_Geocode_Cache_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Google_Geocode_Cache_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Google_Geocode_Cache_Order_By>>;
  where?: InputMaybe<Google_Geocode_Cache_Bool_Exp>;
};


export type Query_RootGoogle_Geocode_Cache_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootItem_CategoriesArgs = {
  distinct_on?: InputMaybe<Array<Item_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Categories_Order_By>>;
  where?: InputMaybe<Item_Categories_Bool_Exp>;
};


export type Query_RootItem_Categories_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Item_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Categories_Order_By>>;
  where?: InputMaybe<Item_Categories_Bool_Exp>;
};


export type Query_RootItem_Categories_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Query_RootItem_ImagesArgs = {
  distinct_on?: InputMaybe<Array<Item_Images_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Images_Order_By>>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};


export type Query_RootItem_Images_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Item_Images_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Images_Order_By>>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};


export type Query_RootItem_Images_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootItem_Sub_CategoriesArgs = {
  distinct_on?: InputMaybe<Array<Item_Sub_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Sub_Categories_Order_By>>;
  where?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
};


export type Query_RootItem_Sub_Categories_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Item_Sub_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Sub_Categories_Order_By>>;
  where?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
};


export type Query_RootItem_Sub_Categories_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Query_RootItemsArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};


export type Query_RootItems_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};


export type Query_RootItems_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootMobile_Payment_TransactionsArgs = {
  distinct_on?: InputMaybe<Array<Mobile_Payment_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mobile_Payment_Transactions_Order_By>>;
  where?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
};


export type Query_RootMobile_Payment_Transactions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mobile_Payment_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mobile_Payment_Transactions_Order_By>>;
  where?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
};


export type Query_RootMobile_Payment_Transactions_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootMtn_Momo_Payment_RequestsArgs = {
  distinct_on?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Order_By>>;
  where?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
};


export type Query_RootMtn_Momo_Payment_Requests_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Order_By>>;
  where?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
};


export type Query_RootMtn_Momo_Payment_Requests_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootOrder_Cancellation_ReasonsArgs = {
  distinct_on?: InputMaybe<Array<Order_Cancellation_Reasons_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Cancellation_Reasons_Order_By>>;
  where?: InputMaybe<Order_Cancellation_Reasons_Bool_Exp>;
};


export type Query_RootOrder_Cancellation_Reasons_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Cancellation_Reasons_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Cancellation_Reasons_Order_By>>;
  where?: InputMaybe<Order_Cancellation_Reasons_Bool_Exp>;
};


export type Query_RootOrder_Cancellation_Reasons_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Query_RootOrder_HoldsArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


export type Query_RootOrder_Holds_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


export type Query_RootOrder_Holds_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootOrder_ItemsArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


export type Query_RootOrder_Items_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


export type Query_RootOrder_Items_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootOrder_Status_HistoryArgs = {
  distinct_on?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Status_History_Order_By>>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};


export type Query_RootOrder_Status_History_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Status_History_Order_By>>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};


export type Query_RootOrder_Status_History_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootOrdersArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


export type Query_RootOrders_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


export type Query_RootOrders_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootPayment_CallbacksArgs = {
  distinct_on?: InputMaybe<Array<Payment_Callbacks_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Payment_Callbacks_Order_By>>;
  where?: InputMaybe<Payment_Callbacks_Bool_Exp>;
};


export type Query_RootPayment_Callbacks_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payment_Callbacks_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Payment_Callbacks_Order_By>>;
  where?: InputMaybe<Payment_Callbacks_Bool_Exp>;
};


export type Query_RootPayment_Callbacks_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootRating_AggregatesArgs = {
  distinct_on?: InputMaybe<Array<Rating_Aggregates_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Rating_Aggregates_Order_By>>;
  where?: InputMaybe<Rating_Aggregates_Bool_Exp>;
};


export type Query_RootRating_Aggregates_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Rating_Aggregates_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Rating_Aggregates_Order_By>>;
  where?: InputMaybe<Rating_Aggregates_Bool_Exp>;
};


export type Query_RootRating_Aggregates_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootRatingsArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


export type Query_RootRatings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


export type Query_RootRatings_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootSupported_Payment_SystemsArgs = {
  distinct_on?: InputMaybe<Array<Supported_Payment_Systems_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Supported_Payment_Systems_Order_By>>;
  where?: InputMaybe<Supported_Payment_Systems_Bool_Exp>;
};


export type Query_RootSupported_Payment_Systems_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Supported_Payment_Systems_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Supported_Payment_Systems_Order_By>>;
  where?: InputMaybe<Supported_Payment_Systems_Bool_Exp>;
};


export type Query_RootSupported_Payment_Systems_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootUser_MessagesArgs = {
  distinct_on?: InputMaybe<Array<User_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Messages_Order_By>>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};


export type Query_RootUser_Messages_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Messages_Order_By>>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};


export type Query_RootUser_Messages_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootUser_TypesArgs = {
  distinct_on?: InputMaybe<Array<User_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Types_Order_By>>;
  where?: InputMaybe<User_Types_Bool_Exp>;
};


export type Query_RootUser_Types_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Types_Order_By>>;
  where?: InputMaybe<User_Types_Bool_Exp>;
};


export type Query_RootUser_Types_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootUser_UploadsArgs = {
  distinct_on?: InputMaybe<Array<User_Uploads_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Uploads_Order_By>>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};


export type Query_RootUser_Uploads_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Uploads_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Uploads_Order_By>>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};


export type Query_RootUser_Uploads_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootUsersArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Query_RootUsers_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Query_RootUsers_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootVehicle_TypesArgs = {
  distinct_on?: InputMaybe<Array<Vehicle_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Vehicle_Types_Order_By>>;
  where?: InputMaybe<Vehicle_Types_Bool_Exp>;
};


export type Query_RootVehicle_Types_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Vehicle_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Vehicle_Types_Order_By>>;
  where?: InputMaybe<Vehicle_Types_Bool_Exp>;
};


export type Query_RootVehicle_Types_By_PkArgs = {
  id: Scalars['String']['input'];
};

/** Cached aggregated rating statistics for performance */
export type Rating_Aggregates = {
  __typename?: 'rating_aggregates';
  average_rating: Scalars['numeric']['output'];
  entity_id: Scalars['uuid']['output'];
  entity_type: Scalars['String']['output'];
  id: Scalars['uuid']['output'];
  last_rating_at?: Maybe<Scalars['timestamptz']['output']>;
  rating_1_count: Scalars['Int']['output'];
  rating_2_count: Scalars['Int']['output'];
  rating_3_count: Scalars['Int']['output'];
  rating_4_count: Scalars['Int']['output'];
  rating_5_count: Scalars['Int']['output'];
  total_ratings: Scalars['Int']['output'];
  updated_at: Scalars['timestamptz']['output'];
};

/** aggregated selection of "rating_aggregates" */
export type Rating_Aggregates_Aggregate = {
  __typename?: 'rating_aggregates_aggregate';
  aggregate?: Maybe<Rating_Aggregates_Aggregate_Fields>;
  nodes: Array<Rating_Aggregates>;
};

/** aggregate fields of "rating_aggregates" */
export type Rating_Aggregates_Aggregate_Fields = {
  __typename?: 'rating_aggregates_aggregate_fields';
  avg?: Maybe<Rating_Aggregates_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Rating_Aggregates_Max_Fields>;
  min?: Maybe<Rating_Aggregates_Min_Fields>;
  stddev?: Maybe<Rating_Aggregates_Stddev_Fields>;
  stddev_pop?: Maybe<Rating_Aggregates_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Rating_Aggregates_Stddev_Samp_Fields>;
  sum?: Maybe<Rating_Aggregates_Sum_Fields>;
  var_pop?: Maybe<Rating_Aggregates_Var_Pop_Fields>;
  var_samp?: Maybe<Rating_Aggregates_Var_Samp_Fields>;
  variance?: Maybe<Rating_Aggregates_Variance_Fields>;
};


/** aggregate fields of "rating_aggregates" */
export type Rating_Aggregates_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Rating_Aggregates_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Rating_Aggregates_Avg_Fields = {
  __typename?: 'rating_aggregates_avg_fields';
  average_rating?: Maybe<Scalars['Float']['output']>;
  rating_1_count?: Maybe<Scalars['Float']['output']>;
  rating_2_count?: Maybe<Scalars['Float']['output']>;
  rating_3_count?: Maybe<Scalars['Float']['output']>;
  rating_4_count?: Maybe<Scalars['Float']['output']>;
  rating_5_count?: Maybe<Scalars['Float']['output']>;
  total_ratings?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "rating_aggregates". All fields are combined with a logical 'AND'. */
export type Rating_Aggregates_Bool_Exp = {
  _and?: InputMaybe<Array<Rating_Aggregates_Bool_Exp>>;
  _not?: InputMaybe<Rating_Aggregates_Bool_Exp>;
  _or?: InputMaybe<Array<Rating_Aggregates_Bool_Exp>>;
  average_rating?: InputMaybe<Numeric_Comparison_Exp>;
  entity_id?: InputMaybe<Uuid_Comparison_Exp>;
  entity_type?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  last_rating_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  rating_1_count?: InputMaybe<Int_Comparison_Exp>;
  rating_2_count?: InputMaybe<Int_Comparison_Exp>;
  rating_3_count?: InputMaybe<Int_Comparison_Exp>;
  rating_4_count?: InputMaybe<Int_Comparison_Exp>;
  rating_5_count?: InputMaybe<Int_Comparison_Exp>;
  total_ratings?: InputMaybe<Int_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "rating_aggregates" */
export enum Rating_Aggregates_Constraint {
  /** unique or primary key constraint on columns "id" */
  RatingAggregatesPkey = 'rating_aggregates_pkey',
  /** unique or primary key constraint on columns "entity_type", "entity_id" */
  UniqueEntityAggregate = 'unique_entity_aggregate'
}

/** input type for incrementing numeric columns in table "rating_aggregates" */
export type Rating_Aggregates_Inc_Input = {
  average_rating?: InputMaybe<Scalars['numeric']['input']>;
  rating_1_count?: InputMaybe<Scalars['Int']['input']>;
  rating_2_count?: InputMaybe<Scalars['Int']['input']>;
  rating_3_count?: InputMaybe<Scalars['Int']['input']>;
  rating_4_count?: InputMaybe<Scalars['Int']['input']>;
  rating_5_count?: InputMaybe<Scalars['Int']['input']>;
  total_ratings?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "rating_aggregates" */
export type Rating_Aggregates_Insert_Input = {
  average_rating?: InputMaybe<Scalars['numeric']['input']>;
  entity_id?: InputMaybe<Scalars['uuid']['input']>;
  entity_type?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  last_rating_at?: InputMaybe<Scalars['timestamptz']['input']>;
  rating_1_count?: InputMaybe<Scalars['Int']['input']>;
  rating_2_count?: InputMaybe<Scalars['Int']['input']>;
  rating_3_count?: InputMaybe<Scalars['Int']['input']>;
  rating_4_count?: InputMaybe<Scalars['Int']['input']>;
  rating_5_count?: InputMaybe<Scalars['Int']['input']>;
  total_ratings?: InputMaybe<Scalars['Int']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Rating_Aggregates_Max_Fields = {
  __typename?: 'rating_aggregates_max_fields';
  average_rating?: Maybe<Scalars['numeric']['output']>;
  entity_id?: Maybe<Scalars['uuid']['output']>;
  entity_type?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  last_rating_at?: Maybe<Scalars['timestamptz']['output']>;
  rating_1_count?: Maybe<Scalars['Int']['output']>;
  rating_2_count?: Maybe<Scalars['Int']['output']>;
  rating_3_count?: Maybe<Scalars['Int']['output']>;
  rating_4_count?: Maybe<Scalars['Int']['output']>;
  rating_5_count?: Maybe<Scalars['Int']['output']>;
  total_ratings?: Maybe<Scalars['Int']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregate min on columns */
export type Rating_Aggregates_Min_Fields = {
  __typename?: 'rating_aggregates_min_fields';
  average_rating?: Maybe<Scalars['numeric']['output']>;
  entity_id?: Maybe<Scalars['uuid']['output']>;
  entity_type?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  last_rating_at?: Maybe<Scalars['timestamptz']['output']>;
  rating_1_count?: Maybe<Scalars['Int']['output']>;
  rating_2_count?: Maybe<Scalars['Int']['output']>;
  rating_3_count?: Maybe<Scalars['Int']['output']>;
  rating_4_count?: Maybe<Scalars['Int']['output']>;
  rating_5_count?: Maybe<Scalars['Int']['output']>;
  total_ratings?: Maybe<Scalars['Int']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** response of any mutation on the table "rating_aggregates" */
export type Rating_Aggregates_Mutation_Response = {
  __typename?: 'rating_aggregates_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Rating_Aggregates>;
};

/** on_conflict condition type for table "rating_aggregates" */
export type Rating_Aggregates_On_Conflict = {
  constraint: Rating_Aggregates_Constraint;
  update_columns?: Array<Rating_Aggregates_Update_Column>;
  where?: InputMaybe<Rating_Aggregates_Bool_Exp>;
};

/** Ordering options when selecting data from "rating_aggregates". */
export type Rating_Aggregates_Order_By = {
  average_rating?: InputMaybe<Order_By>;
  entity_id?: InputMaybe<Order_By>;
  entity_type?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  last_rating_at?: InputMaybe<Order_By>;
  rating_1_count?: InputMaybe<Order_By>;
  rating_2_count?: InputMaybe<Order_By>;
  rating_3_count?: InputMaybe<Order_By>;
  rating_4_count?: InputMaybe<Order_By>;
  rating_5_count?: InputMaybe<Order_By>;
  total_ratings?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: rating_aggregates */
export type Rating_Aggregates_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "rating_aggregates" */
export enum Rating_Aggregates_Select_Column {
  /** column name */
  AverageRating = 'average_rating',
  /** column name */
  EntityId = 'entity_id',
  /** column name */
  EntityType = 'entity_type',
  /** column name */
  Id = 'id',
  /** column name */
  LastRatingAt = 'last_rating_at',
  /** column name */
  Rating_1Count = 'rating_1_count',
  /** column name */
  Rating_2Count = 'rating_2_count',
  /** column name */
  Rating_3Count = 'rating_3_count',
  /** column name */
  Rating_4Count = 'rating_4_count',
  /** column name */
  Rating_5Count = 'rating_5_count',
  /** column name */
  TotalRatings = 'total_ratings',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "rating_aggregates" */
export type Rating_Aggregates_Set_Input = {
  average_rating?: InputMaybe<Scalars['numeric']['input']>;
  entity_id?: InputMaybe<Scalars['uuid']['input']>;
  entity_type?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  last_rating_at?: InputMaybe<Scalars['timestamptz']['input']>;
  rating_1_count?: InputMaybe<Scalars['Int']['input']>;
  rating_2_count?: InputMaybe<Scalars['Int']['input']>;
  rating_3_count?: InputMaybe<Scalars['Int']['input']>;
  rating_4_count?: InputMaybe<Scalars['Int']['input']>;
  rating_5_count?: InputMaybe<Scalars['Int']['input']>;
  total_ratings?: InputMaybe<Scalars['Int']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Rating_Aggregates_Stddev_Fields = {
  __typename?: 'rating_aggregates_stddev_fields';
  average_rating?: Maybe<Scalars['Float']['output']>;
  rating_1_count?: Maybe<Scalars['Float']['output']>;
  rating_2_count?: Maybe<Scalars['Float']['output']>;
  rating_3_count?: Maybe<Scalars['Float']['output']>;
  rating_4_count?: Maybe<Scalars['Float']['output']>;
  rating_5_count?: Maybe<Scalars['Float']['output']>;
  total_ratings?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Rating_Aggregates_Stddev_Pop_Fields = {
  __typename?: 'rating_aggregates_stddev_pop_fields';
  average_rating?: Maybe<Scalars['Float']['output']>;
  rating_1_count?: Maybe<Scalars['Float']['output']>;
  rating_2_count?: Maybe<Scalars['Float']['output']>;
  rating_3_count?: Maybe<Scalars['Float']['output']>;
  rating_4_count?: Maybe<Scalars['Float']['output']>;
  rating_5_count?: Maybe<Scalars['Float']['output']>;
  total_ratings?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Rating_Aggregates_Stddev_Samp_Fields = {
  __typename?: 'rating_aggregates_stddev_samp_fields';
  average_rating?: Maybe<Scalars['Float']['output']>;
  rating_1_count?: Maybe<Scalars['Float']['output']>;
  rating_2_count?: Maybe<Scalars['Float']['output']>;
  rating_3_count?: Maybe<Scalars['Float']['output']>;
  rating_4_count?: Maybe<Scalars['Float']['output']>;
  rating_5_count?: Maybe<Scalars['Float']['output']>;
  total_ratings?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "rating_aggregates" */
export type Rating_Aggregates_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Rating_Aggregates_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Rating_Aggregates_Stream_Cursor_Value_Input = {
  average_rating?: InputMaybe<Scalars['numeric']['input']>;
  entity_id?: InputMaybe<Scalars['uuid']['input']>;
  entity_type?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  last_rating_at?: InputMaybe<Scalars['timestamptz']['input']>;
  rating_1_count?: InputMaybe<Scalars['Int']['input']>;
  rating_2_count?: InputMaybe<Scalars['Int']['input']>;
  rating_3_count?: InputMaybe<Scalars['Int']['input']>;
  rating_4_count?: InputMaybe<Scalars['Int']['input']>;
  rating_5_count?: InputMaybe<Scalars['Int']['input']>;
  total_ratings?: InputMaybe<Scalars['Int']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Rating_Aggregates_Sum_Fields = {
  __typename?: 'rating_aggregates_sum_fields';
  average_rating?: Maybe<Scalars['numeric']['output']>;
  rating_1_count?: Maybe<Scalars['Int']['output']>;
  rating_2_count?: Maybe<Scalars['Int']['output']>;
  rating_3_count?: Maybe<Scalars['Int']['output']>;
  rating_4_count?: Maybe<Scalars['Int']['output']>;
  rating_5_count?: Maybe<Scalars['Int']['output']>;
  total_ratings?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "rating_aggregates" */
export enum Rating_Aggregates_Update_Column {
  /** column name */
  AverageRating = 'average_rating',
  /** column name */
  EntityId = 'entity_id',
  /** column name */
  EntityType = 'entity_type',
  /** column name */
  Id = 'id',
  /** column name */
  LastRatingAt = 'last_rating_at',
  /** column name */
  Rating_1Count = 'rating_1_count',
  /** column name */
  Rating_2Count = 'rating_2_count',
  /** column name */
  Rating_3Count = 'rating_3_count',
  /** column name */
  Rating_4Count = 'rating_4_count',
  /** column name */
  Rating_5Count = 'rating_5_count',
  /** column name */
  TotalRatings = 'total_ratings',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Rating_Aggregates_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Rating_Aggregates_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Rating_Aggregates_Set_Input>;
  /** filter the rows which have to be updated */
  where: Rating_Aggregates_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Rating_Aggregates_Var_Pop_Fields = {
  __typename?: 'rating_aggregates_var_pop_fields';
  average_rating?: Maybe<Scalars['Float']['output']>;
  rating_1_count?: Maybe<Scalars['Float']['output']>;
  rating_2_count?: Maybe<Scalars['Float']['output']>;
  rating_3_count?: Maybe<Scalars['Float']['output']>;
  rating_4_count?: Maybe<Scalars['Float']['output']>;
  rating_5_count?: Maybe<Scalars['Float']['output']>;
  total_ratings?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Rating_Aggregates_Var_Samp_Fields = {
  __typename?: 'rating_aggregates_var_samp_fields';
  average_rating?: Maybe<Scalars['Float']['output']>;
  rating_1_count?: Maybe<Scalars['Float']['output']>;
  rating_2_count?: Maybe<Scalars['Float']['output']>;
  rating_3_count?: Maybe<Scalars['Float']['output']>;
  rating_4_count?: Maybe<Scalars['Float']['output']>;
  rating_5_count?: Maybe<Scalars['Float']['output']>;
  total_ratings?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Rating_Aggregates_Variance_Fields = {
  __typename?: 'rating_aggregates_variance_fields';
  average_rating?: Maybe<Scalars['Float']['output']>;
  rating_1_count?: Maybe<Scalars['Float']['output']>;
  rating_2_count?: Maybe<Scalars['Float']['output']>;
  rating_3_count?: Maybe<Scalars['Float']['output']>;
  rating_4_count?: Maybe<Scalars['Float']['output']>;
  rating_5_count?: Maybe<Scalars['Float']['output']>;
  total_ratings?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to compare columns of type "rating_type_enum". All fields are combined with logical 'AND'. */
export type Rating_Type_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['rating_type_enum']['input']>;
  _gt?: InputMaybe<Scalars['rating_type_enum']['input']>;
  _gte?: InputMaybe<Scalars['rating_type_enum']['input']>;
  _in?: InputMaybe<Array<Scalars['rating_type_enum']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['rating_type_enum']['input']>;
  _lte?: InputMaybe<Scalars['rating_type_enum']['input']>;
  _neq?: InputMaybe<Scalars['rating_type_enum']['input']>;
  _nin?: InputMaybe<Array<Scalars['rating_type_enum']['input']>>;
};

/** Stores all ratings given by users in the system */
export type Ratings = {
  __typename?: 'ratings';
  comment?: Maybe<Scalars['String']['output']>;
  created_at: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  is_public?: Maybe<Scalars['Boolean']['output']>;
  /** Whether this rating is from a verified completed order */
  is_verified?: Maybe<Scalars['Boolean']['output']>;
  /** An object relationship */
  order_details: Orders;
  order_id: Scalars['uuid']['output'];
  /** ID of the entity being rated */
  rated_entity_id: Scalars['uuid']['output'];
  /** Type of entity being rated */
  rated_entity_type: Scalars['String']['output'];
  /** An object relationship */
  rater_user_details: Users;
  /** User giving the rating (type inferred from user profile) */
  rater_user_id: Scalars['uuid']['output'];
  /** Rating value from 1 to 5 */
  rating: Scalars['Int']['output'];
  /** Type of rating being given */
  rating_type: Scalars['rating_type_enum']['output'];
  updated_at: Scalars['timestamptz']['output'];
};

/** aggregated selection of "ratings" */
export type Ratings_Aggregate = {
  __typename?: 'ratings_aggregate';
  aggregate?: Maybe<Ratings_Aggregate_Fields>;
  nodes: Array<Ratings>;
};

export type Ratings_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Ratings_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Ratings_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Ratings_Aggregate_Bool_Exp_Count>;
};

export type Ratings_Aggregate_Bool_Exp_Bool_And = {
  arguments: Ratings_Select_Column_Ratings_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Ratings_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Ratings_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Ratings_Select_Column_Ratings_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Ratings_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Ratings_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Ratings_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Ratings_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "ratings" */
export type Ratings_Aggregate_Fields = {
  __typename?: 'ratings_aggregate_fields';
  avg?: Maybe<Ratings_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Ratings_Max_Fields>;
  min?: Maybe<Ratings_Min_Fields>;
  stddev?: Maybe<Ratings_Stddev_Fields>;
  stddev_pop?: Maybe<Ratings_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Ratings_Stddev_Samp_Fields>;
  sum?: Maybe<Ratings_Sum_Fields>;
  var_pop?: Maybe<Ratings_Var_Pop_Fields>;
  var_samp?: Maybe<Ratings_Var_Samp_Fields>;
  variance?: Maybe<Ratings_Variance_Fields>;
};


/** aggregate fields of "ratings" */
export type Ratings_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Ratings_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "ratings" */
export type Ratings_Aggregate_Order_By = {
  avg?: InputMaybe<Ratings_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Ratings_Max_Order_By>;
  min?: InputMaybe<Ratings_Min_Order_By>;
  stddev?: InputMaybe<Ratings_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Ratings_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Ratings_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Ratings_Sum_Order_By>;
  var_pop?: InputMaybe<Ratings_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Ratings_Var_Samp_Order_By>;
  variance?: InputMaybe<Ratings_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "ratings" */
export type Ratings_Arr_Rel_Insert_Input = {
  data: Array<Ratings_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Ratings_On_Conflict>;
};

/** aggregate avg on columns */
export type Ratings_Avg_Fields = {
  __typename?: 'ratings_avg_fields';
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "ratings" */
export type Ratings_Avg_Order_By = {
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "ratings". All fields are combined with a logical 'AND'. */
export type Ratings_Bool_Exp = {
  _and?: InputMaybe<Array<Ratings_Bool_Exp>>;
  _not?: InputMaybe<Ratings_Bool_Exp>;
  _or?: InputMaybe<Array<Ratings_Bool_Exp>>;
  comment?: InputMaybe<String_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_public?: InputMaybe<Boolean_Comparison_Exp>;
  is_verified?: InputMaybe<Boolean_Comparison_Exp>;
  order_details?: InputMaybe<Orders_Bool_Exp>;
  order_id?: InputMaybe<Uuid_Comparison_Exp>;
  rated_entity_id?: InputMaybe<Uuid_Comparison_Exp>;
  rated_entity_type?: InputMaybe<String_Comparison_Exp>;
  rater_user_details?: InputMaybe<Users_Bool_Exp>;
  rater_user_id?: InputMaybe<Uuid_Comparison_Exp>;
  rating?: InputMaybe<Int_Comparison_Exp>;
  rating_type?: InputMaybe<Rating_Type_Enum_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "ratings" */
export enum Ratings_Constraint {
  /** unique or primary key constraint on columns "id" */
  RatingsPkey = 'ratings_pkey',
  /** unique or primary key constraint on columns "rating_type", "order_id", "rater_user_id" */
  UniqueRatingPerOrder = 'unique_rating_per_order'
}

/** input type for incrementing numeric columns in table "ratings" */
export type Ratings_Inc_Input = {
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "ratings" */
export type Ratings_Insert_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_public?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether this rating is from a verified completed order */
  is_verified?: InputMaybe<Scalars['Boolean']['input']>;
  order_details?: InputMaybe<Orders_Obj_Rel_Insert_Input>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  /** ID of the entity being rated */
  rated_entity_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Type of entity being rated */
  rated_entity_type?: InputMaybe<Scalars['String']['input']>;
  rater_user_details?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  /** User giving the rating (type inferred from user profile) */
  rater_user_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Scalars['Int']['input']>;
  /** Type of rating being given */
  rating_type?: InputMaybe<Scalars['rating_type_enum']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Ratings_Max_Fields = {
  __typename?: 'ratings_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  /** ID of the entity being rated */
  rated_entity_id?: Maybe<Scalars['uuid']['output']>;
  /** Type of entity being rated */
  rated_entity_type?: Maybe<Scalars['String']['output']>;
  /** User giving the rating (type inferred from user profile) */
  rater_user_id?: Maybe<Scalars['uuid']['output']>;
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Int']['output']>;
  /** Type of rating being given */
  rating_type?: Maybe<Scalars['rating_type_enum']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "ratings" */
export type Ratings_Max_Order_By = {
  comment?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  /** ID of the entity being rated */
  rated_entity_id?: InputMaybe<Order_By>;
  /** Type of entity being rated */
  rated_entity_type?: InputMaybe<Order_By>;
  /** User giving the rating (type inferred from user profile) */
  rater_user_id?: InputMaybe<Order_By>;
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
  /** Type of rating being given */
  rating_type?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Ratings_Min_Fields = {
  __typename?: 'ratings_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  order_id?: Maybe<Scalars['uuid']['output']>;
  /** ID of the entity being rated */
  rated_entity_id?: Maybe<Scalars['uuid']['output']>;
  /** Type of entity being rated */
  rated_entity_type?: Maybe<Scalars['String']['output']>;
  /** User giving the rating (type inferred from user profile) */
  rater_user_id?: Maybe<Scalars['uuid']['output']>;
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Int']['output']>;
  /** Type of rating being given */
  rating_type?: Maybe<Scalars['rating_type_enum']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "ratings" */
export type Ratings_Min_Order_By = {
  comment?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  order_id?: InputMaybe<Order_By>;
  /** ID of the entity being rated */
  rated_entity_id?: InputMaybe<Order_By>;
  /** Type of entity being rated */
  rated_entity_type?: InputMaybe<Order_By>;
  /** User giving the rating (type inferred from user profile) */
  rater_user_id?: InputMaybe<Order_By>;
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
  /** Type of rating being given */
  rating_type?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "ratings" */
export type Ratings_Mutation_Response = {
  __typename?: 'ratings_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Ratings>;
};

/** on_conflict condition type for table "ratings" */
export type Ratings_On_Conflict = {
  constraint: Ratings_Constraint;
  update_columns?: Array<Ratings_Update_Column>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};

/** Ordering options when selecting data from "ratings". */
export type Ratings_Order_By = {
  comment?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_public?: InputMaybe<Order_By>;
  is_verified?: InputMaybe<Order_By>;
  order_details?: InputMaybe<Orders_Order_By>;
  order_id?: InputMaybe<Order_By>;
  rated_entity_id?: InputMaybe<Order_By>;
  rated_entity_type?: InputMaybe<Order_By>;
  rater_user_details?: InputMaybe<Users_Order_By>;
  rater_user_id?: InputMaybe<Order_By>;
  rating?: InputMaybe<Order_By>;
  rating_type?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: ratings */
export type Ratings_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "ratings" */
export enum Ratings_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsPublic = 'is_public',
  /** column name */
  IsVerified = 'is_verified',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  RatedEntityId = 'rated_entity_id',
  /** column name */
  RatedEntityType = 'rated_entity_type',
  /** column name */
  RaterUserId = 'rater_user_id',
  /** column name */
  Rating = 'rating',
  /** column name */
  RatingType = 'rating_type',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** select "ratings_aggregate_bool_exp_bool_and_arguments_columns" columns of table "ratings" */
export enum Ratings_Select_Column_Ratings_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsPublic = 'is_public',
  /** column name */
  IsVerified = 'is_verified'
}

/** select "ratings_aggregate_bool_exp_bool_or_arguments_columns" columns of table "ratings" */
export enum Ratings_Select_Column_Ratings_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsPublic = 'is_public',
  /** column name */
  IsVerified = 'is_verified'
}

/** input type for updating data in table "ratings" */
export type Ratings_Set_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_public?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether this rating is from a verified completed order */
  is_verified?: InputMaybe<Scalars['Boolean']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  /** ID of the entity being rated */
  rated_entity_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Type of entity being rated */
  rated_entity_type?: InputMaybe<Scalars['String']['input']>;
  /** User giving the rating (type inferred from user profile) */
  rater_user_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Scalars['Int']['input']>;
  /** Type of rating being given */
  rating_type?: InputMaybe<Scalars['rating_type_enum']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate stddev on columns */
export type Ratings_Stddev_Fields = {
  __typename?: 'ratings_stddev_fields';
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "ratings" */
export type Ratings_Stddev_Order_By = {
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Ratings_Stddev_Pop_Fields = {
  __typename?: 'ratings_stddev_pop_fields';
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "ratings" */
export type Ratings_Stddev_Pop_Order_By = {
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Ratings_Stddev_Samp_Fields = {
  __typename?: 'ratings_stddev_samp_fields';
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "ratings" */
export type Ratings_Stddev_Samp_Order_By = {
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "ratings" */
export type Ratings_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Ratings_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Ratings_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_public?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether this rating is from a verified completed order */
  is_verified?: InputMaybe<Scalars['Boolean']['input']>;
  order_id?: InputMaybe<Scalars['uuid']['input']>;
  /** ID of the entity being rated */
  rated_entity_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Type of entity being rated */
  rated_entity_type?: InputMaybe<Scalars['String']['input']>;
  /** User giving the rating (type inferred from user profile) */
  rater_user_id?: InputMaybe<Scalars['uuid']['input']>;
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Scalars['Int']['input']>;
  /** Type of rating being given */
  rating_type?: InputMaybe<Scalars['rating_type_enum']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type Ratings_Sum_Fields = {
  __typename?: 'ratings_sum_fields';
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "ratings" */
export type Ratings_Sum_Order_By = {
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
};

/** update columns of table "ratings" */
export enum Ratings_Update_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  IsPublic = 'is_public',
  /** column name */
  IsVerified = 'is_verified',
  /** column name */
  OrderId = 'order_id',
  /** column name */
  RatedEntityId = 'rated_entity_id',
  /** column name */
  RatedEntityType = 'rated_entity_type',
  /** column name */
  RaterUserId = 'rater_user_id',
  /** column name */
  Rating = 'rating',
  /** column name */
  RatingType = 'rating_type',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Ratings_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Ratings_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Ratings_Set_Input>;
  /** filter the rows which have to be updated */
  where: Ratings_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Ratings_Var_Pop_Fields = {
  __typename?: 'ratings_var_pop_fields';
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "ratings" */
export type Ratings_Var_Pop_Order_By = {
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Ratings_Var_Samp_Fields = {
  __typename?: 'ratings_var_samp_fields';
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "ratings" */
export type Ratings_Var_Samp_Order_By = {
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Ratings_Variance_Fields = {
  __typename?: 'ratings_variance_fields';
  /** Rating value from 1 to 5 */
  rating?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "ratings" */
export type Ratings_Variance_Order_By = {
  /** Rating value from 1 to 5 */
  rating?: InputMaybe<Order_By>;
};

export type Subscription_Root = {
  __typename?: 'subscription_root';
  /** An array relationship */
  account_transactions: Array<Account_Transactions>;
  /** An aggregate relationship */
  account_transactions_aggregate: Account_Transactions_Aggregate;
  /** fetch data from the table: "account_transactions" using primary key columns */
  account_transactions_by_pk?: Maybe<Account_Transactions>;
  /** fetch data from the table in a streaming manner: "account_transactions" */
  account_transactions_stream: Array<Account_Transactions>;
  /** An array relationship */
  accounts: Array<Accounts>;
  /** An aggregate relationship */
  accounts_aggregate: Accounts_Aggregate;
  /** fetch data from the table: "accounts" using primary key columns */
  accounts_by_pk?: Maybe<Accounts>;
  /** fetch data from the table in a streaming manner: "accounts" */
  accounts_stream: Array<Accounts>;
  /** fetch data from the table: "addresses" */
  addresses: Array<Addresses>;
  /** fetch aggregated fields from the table: "addresses" */
  addresses_aggregate: Addresses_Aggregate;
  /** fetch data from the table: "addresses" using primary key columns */
  addresses_by_pk?: Maybe<Addresses>;
  /** fetch data from the table in a streaming manner: "addresses" */
  addresses_stream: Array<Addresses>;
  /** An array relationship */
  agent_addresses: Array<Agent_Addresses>;
  /** An aggregate relationship */
  agent_addresses_aggregate: Agent_Addresses_Aggregate;
  /** fetch data from the table: "agent_addresses" using primary key columns */
  agent_addresses_by_pk?: Maybe<Agent_Addresses>;
  /** fetch data from the table in a streaming manner: "agent_addresses" */
  agent_addresses_stream: Array<Agent_Addresses>;
  /** An array relationship */
  agents: Array<Agents>;
  /** An aggregate relationship */
  agents_aggregate: Agents_Aggregate;
  /** fetch data from the table: "agents" using primary key columns */
  agents_by_pk?: Maybe<Agents>;
  /** fetch data from the table in a streaming manner: "agents" */
  agents_stream: Array<Agents>;
  /** An array relationship */
  airtel_money_payments: Array<Airtel_Money_Payments>;
  /** An aggregate relationship */
  airtel_money_payments_aggregate: Airtel_Money_Payments_Aggregate;
  /** fetch data from the table: "airtel_money_payments" using primary key columns */
  airtel_money_payments_by_pk?: Maybe<Airtel_Money_Payments>;
  /** fetch data from the table in a streaming manner: "airtel_money_payments" */
  airtel_money_payments_stream: Array<Airtel_Money_Payments>;
  /** fetch data from the table: "application_configurations" */
  application_configurations: Array<Application_Configurations>;
  /** fetch aggregated fields from the table: "application_configurations" */
  application_configurations_aggregate: Application_Configurations_Aggregate;
  /** fetch data from the table: "application_configurations" using primary key columns */
  application_configurations_by_pk?: Maybe<Application_Configurations>;
  /** fetch data from the table in a streaming manner: "application_configurations" */
  application_configurations_stream: Array<Application_Configurations>;
  /** fetch data from the table: "brands" */
  brands: Array<Brands>;
  /** fetch aggregated fields from the table: "brands" */
  brands_aggregate: Brands_Aggregate;
  /** fetch data from the table: "brands" using primary key columns */
  brands_by_pk?: Maybe<Brands>;
  /** fetch data from the table in a streaming manner: "brands" */
  brands_stream: Array<Brands>;
  /** An array relationship */
  business_addresses: Array<Business_Addresses>;
  /** An aggregate relationship */
  business_addresses_aggregate: Business_Addresses_Aggregate;
  /** fetch data from the table: "business_addresses" using primary key columns */
  business_addresses_by_pk?: Maybe<Business_Addresses>;
  /** fetch data from the table in a streaming manner: "business_addresses" */
  business_addresses_stream: Array<Business_Addresses>;
  /** An array relationship */
  business_inventory: Array<Business_Inventory>;
  /** An aggregate relationship */
  business_inventory_aggregate: Business_Inventory_Aggregate;
  /** fetch data from the table: "business_inventory" using primary key columns */
  business_inventory_by_pk?: Maybe<Business_Inventory>;
  /** fetch data from the table in a streaming manner: "business_inventory" */
  business_inventory_stream: Array<Business_Inventory>;
  /** An array relationship */
  business_locations: Array<Business_Locations>;
  /** An aggregate relationship */
  business_locations_aggregate: Business_Locations_Aggregate;
  /** fetch data from the table: "business_locations" using primary key columns */
  business_locations_by_pk?: Maybe<Business_Locations>;
  /** fetch data from the table in a streaming manner: "business_locations" */
  business_locations_stream: Array<Business_Locations>;
  /** fetch data from the table: "businesses" */
  businesses: Array<Businesses>;
  /** fetch aggregated fields from the table: "businesses" */
  businesses_aggregate: Businesses_Aggregate;
  /** fetch data from the table: "businesses" using primary key columns */
  businesses_by_pk?: Maybe<Businesses>;
  /** fetch data from the table in a streaming manner: "businesses" */
  businesses_stream: Array<Businesses>;
  /** An array relationship */
  client_addresses: Array<Client_Addresses>;
  /** An aggregate relationship */
  client_addresses_aggregate: Client_Addresses_Aggregate;
  /** fetch data from the table: "client_addresses" using primary key columns */
  client_addresses_by_pk?: Maybe<Client_Addresses>;
  /** fetch data from the table in a streaming manner: "client_addresses" */
  client_addresses_stream: Array<Client_Addresses>;
  /** fetch data from the table: "clients" */
  clients: Array<Clients>;
  /** fetch aggregated fields from the table: "clients" */
  clients_aggregate: Clients_Aggregate;
  /** fetch data from the table: "clients" using primary key columns */
  clients_by_pk?: Maybe<Clients>;
  /** fetch data from the table in a streaming manner: "clients" */
  clients_stream: Array<Clients>;
  /** fetch data from the table: "delivery_fees" */
  delivery_fees: Array<Delivery_Fees>;
  /** fetch aggregated fields from the table: "delivery_fees" */
  delivery_fees_aggregate: Delivery_Fees_Aggregate;
  /** fetch data from the table: "delivery_fees" using primary key columns */
  delivery_fees_by_pk?: Maybe<Delivery_Fees>;
  /** fetch data from the table in a streaming manner: "delivery_fees" */
  delivery_fees_stream: Array<Delivery_Fees>;
  /** fetch data from the table: "delivery_time_slots" */
  delivery_time_slots: Array<Delivery_Time_Slots>;
  /** fetch aggregated fields from the table: "delivery_time_slots" */
  delivery_time_slots_aggregate: Delivery_Time_Slots_Aggregate;
  /** fetch data from the table: "delivery_time_slots" using primary key columns */
  delivery_time_slots_by_pk?: Maybe<Delivery_Time_Slots>;
  /** fetch data from the table in a streaming manner: "delivery_time_slots" */
  delivery_time_slots_stream: Array<Delivery_Time_Slots>;
  /** An array relationship */
  delivery_time_windows: Array<Delivery_Time_Windows>;
  /** An aggregate relationship */
  delivery_time_windows_aggregate: Delivery_Time_Windows_Aggregate;
  /** fetch data from the table: "delivery_time_windows" using primary key columns */
  delivery_time_windows_by_pk?: Maybe<Delivery_Time_Windows>;
  /** fetch data from the table in a streaming manner: "delivery_time_windows" */
  delivery_time_windows_stream: Array<Delivery_Time_Windows>;
  /** fetch data from the table: "document_types" */
  document_types: Array<Document_Types>;
  /** fetch aggregated fields from the table: "document_types" */
  document_types_aggregate: Document_Types_Aggregate;
  /** fetch data from the table: "document_types" using primary key columns */
  document_types_by_pk?: Maybe<Document_Types>;
  /** fetch data from the table in a streaming manner: "document_types" */
  document_types_stream: Array<Document_Types>;
  /** fetch data from the table: "entity_types" */
  entity_types: Array<Entity_Types>;
  /** fetch aggregated fields from the table: "entity_types" */
  entity_types_aggregate: Entity_Types_Aggregate;
  /** fetch data from the table: "entity_types" using primary key columns */
  entity_types_by_pk?: Maybe<Entity_Types>;
  /** fetch data from the table in a streaming manner: "entity_types" */
  entity_types_stream: Array<Entity_Types>;
  /** fetch data from the table: "google_distance_cache" */
  google_distance_cache: Array<Google_Distance_Cache>;
  /** fetch aggregated fields from the table: "google_distance_cache" */
  google_distance_cache_aggregate: Google_Distance_Cache_Aggregate;
  /** fetch data from the table: "google_distance_cache" using primary key columns */
  google_distance_cache_by_pk?: Maybe<Google_Distance_Cache>;
  /** fetch data from the table in a streaming manner: "google_distance_cache" */
  google_distance_cache_stream: Array<Google_Distance_Cache>;
  /** fetch data from the table: "google_geocode_cache" */
  google_geocode_cache: Array<Google_Geocode_Cache>;
  /** fetch aggregated fields from the table: "google_geocode_cache" */
  google_geocode_cache_aggregate: Google_Geocode_Cache_Aggregate;
  /** fetch data from the table: "google_geocode_cache" using primary key columns */
  google_geocode_cache_by_pk?: Maybe<Google_Geocode_Cache>;
  /** fetch data from the table in a streaming manner: "google_geocode_cache" */
  google_geocode_cache_stream: Array<Google_Geocode_Cache>;
  /** fetch data from the table: "item_categories" */
  item_categories: Array<Item_Categories>;
  /** fetch aggregated fields from the table: "item_categories" */
  item_categories_aggregate: Item_Categories_Aggregate;
  /** fetch data from the table: "item_categories" using primary key columns */
  item_categories_by_pk?: Maybe<Item_Categories>;
  /** fetch data from the table in a streaming manner: "item_categories" */
  item_categories_stream: Array<Item_Categories>;
  /** An array relationship */
  item_images: Array<Item_Images>;
  /** An aggregate relationship */
  item_images_aggregate: Item_Images_Aggregate;
  /** fetch data from the table: "item_images" using primary key columns */
  item_images_by_pk?: Maybe<Item_Images>;
  /** fetch data from the table in a streaming manner: "item_images" */
  item_images_stream: Array<Item_Images>;
  /** An array relationship */
  item_sub_categories: Array<Item_Sub_Categories>;
  /** An aggregate relationship */
  item_sub_categories_aggregate: Item_Sub_Categories_Aggregate;
  /** fetch data from the table: "item_sub_categories" using primary key columns */
  item_sub_categories_by_pk?: Maybe<Item_Sub_Categories>;
  /** fetch data from the table in a streaming manner: "item_sub_categories" */
  item_sub_categories_stream: Array<Item_Sub_Categories>;
  /** An array relationship */
  items: Array<Items>;
  /** An aggregate relationship */
  items_aggregate: Items_Aggregate;
  /** fetch data from the table: "items" using primary key columns */
  items_by_pk?: Maybe<Items>;
  /** fetch data from the table in a streaming manner: "items" */
  items_stream: Array<Items>;
  /** An array relationship */
  mobile_payment_transactions: Array<Mobile_Payment_Transactions>;
  /** An aggregate relationship */
  mobile_payment_transactions_aggregate: Mobile_Payment_Transactions_Aggregate;
  /** fetch data from the table: "mobile_payment_transactions" using primary key columns */
  mobile_payment_transactions_by_pk?: Maybe<Mobile_Payment_Transactions>;
  /** fetch data from the table in a streaming manner: "mobile_payment_transactions" */
  mobile_payment_transactions_stream: Array<Mobile_Payment_Transactions>;
  /** An array relationship */
  mtn_momo_payment_requests: Array<Mtn_Momo_Payment_Requests>;
  /** An aggregate relationship */
  mtn_momo_payment_requests_aggregate: Mtn_Momo_Payment_Requests_Aggregate;
  /** fetch data from the table: "mtn_momo_payment_requests" using primary key columns */
  mtn_momo_payment_requests_by_pk?: Maybe<Mtn_Momo_Payment_Requests>;
  /** fetch data from the table in a streaming manner: "mtn_momo_payment_requests" */
  mtn_momo_payment_requests_stream: Array<Mtn_Momo_Payment_Requests>;
  /** fetch data from the table: "order_cancellation_reasons" */
  order_cancellation_reasons: Array<Order_Cancellation_Reasons>;
  /** fetch aggregated fields from the table: "order_cancellation_reasons" */
  order_cancellation_reasons_aggregate: Order_Cancellation_Reasons_Aggregate;
  /** fetch data from the table: "order_cancellation_reasons" using primary key columns */
  order_cancellation_reasons_by_pk?: Maybe<Order_Cancellation_Reasons>;
  /** fetch data from the table in a streaming manner: "order_cancellation_reasons" */
  order_cancellation_reasons_stream: Array<Order_Cancellation_Reasons>;
  /** An array relationship */
  order_holds: Array<Order_Holds>;
  /** An aggregate relationship */
  order_holds_aggregate: Order_Holds_Aggregate;
  /** fetch data from the table: "order_holds" using primary key columns */
  order_holds_by_pk?: Maybe<Order_Holds>;
  /** fetch data from the table in a streaming manner: "order_holds" */
  order_holds_stream: Array<Order_Holds>;
  /** An array relationship */
  order_items: Array<Order_Items>;
  /** An aggregate relationship */
  order_items_aggregate: Order_Items_Aggregate;
  /** fetch data from the table: "order_items" using primary key columns */
  order_items_by_pk?: Maybe<Order_Items>;
  /** fetch data from the table in a streaming manner: "order_items" */
  order_items_stream: Array<Order_Items>;
  /** An array relationship */
  order_status_history: Array<Order_Status_History>;
  /** An aggregate relationship */
  order_status_history_aggregate: Order_Status_History_Aggregate;
  /** fetch data from the table: "order_status_history" using primary key columns */
  order_status_history_by_pk?: Maybe<Order_Status_History>;
  /** fetch data from the table in a streaming manner: "order_status_history" */
  order_status_history_stream: Array<Order_Status_History>;
  /** An array relationship */
  orders: Array<Orders>;
  /** An aggregate relationship */
  orders_aggregate: Orders_Aggregate;
  /** fetch data from the table: "orders" using primary key columns */
  orders_by_pk?: Maybe<Orders>;
  /** fetch data from the table in a streaming manner: "orders" */
  orders_stream: Array<Orders>;
  /** An array relationship */
  payment_callbacks: Array<Payment_Callbacks>;
  /** An aggregate relationship */
  payment_callbacks_aggregate: Payment_Callbacks_Aggregate;
  /** fetch data from the table: "payment_callbacks" using primary key columns */
  payment_callbacks_by_pk?: Maybe<Payment_Callbacks>;
  /** fetch data from the table in a streaming manner: "payment_callbacks" */
  payment_callbacks_stream: Array<Payment_Callbacks>;
  /** fetch data from the table: "rating_aggregates" */
  rating_aggregates: Array<Rating_Aggregates>;
  /** fetch aggregated fields from the table: "rating_aggregates" */
  rating_aggregates_aggregate: Rating_Aggregates_Aggregate;
  /** fetch data from the table: "rating_aggregates" using primary key columns */
  rating_aggregates_by_pk?: Maybe<Rating_Aggregates>;
  /** fetch data from the table in a streaming manner: "rating_aggregates" */
  rating_aggregates_stream: Array<Rating_Aggregates>;
  /** An array relationship */
  ratings: Array<Ratings>;
  /** An aggregate relationship */
  ratings_aggregate: Ratings_Aggregate;
  /** fetch data from the table: "ratings" using primary key columns */
  ratings_by_pk?: Maybe<Ratings>;
  /** fetch data from the table in a streaming manner: "ratings" */
  ratings_stream: Array<Ratings>;
  /** fetch data from the table: "supported_payment_systems" */
  supported_payment_systems: Array<Supported_Payment_Systems>;
  /** fetch aggregated fields from the table: "supported_payment_systems" */
  supported_payment_systems_aggregate: Supported_Payment_Systems_Aggregate;
  /** fetch data from the table: "supported_payment_systems" using primary key columns */
  supported_payment_systems_by_pk?: Maybe<Supported_Payment_Systems>;
  /** fetch data from the table in a streaming manner: "supported_payment_systems" */
  supported_payment_systems_stream: Array<Supported_Payment_Systems>;
  /** An array relationship */
  user_messages: Array<User_Messages>;
  /** An aggregate relationship */
  user_messages_aggregate: User_Messages_Aggregate;
  /** fetch data from the table: "user_messages" using primary key columns */
  user_messages_by_pk?: Maybe<User_Messages>;
  /** fetch data from the table in a streaming manner: "user_messages" */
  user_messages_stream: Array<User_Messages>;
  /** fetch data from the table: "user_types" */
  user_types: Array<User_Types>;
  /** fetch aggregated fields from the table: "user_types" */
  user_types_aggregate: User_Types_Aggregate;
  /** fetch data from the table: "user_types" using primary key columns */
  user_types_by_pk?: Maybe<User_Types>;
  /** fetch data from the table in a streaming manner: "user_types" */
  user_types_stream: Array<User_Types>;
  /** An array relationship */
  user_uploads: Array<User_Uploads>;
  /** An aggregate relationship */
  user_uploads_aggregate: User_Uploads_Aggregate;
  /** fetch data from the table: "user_uploads" using primary key columns */
  user_uploads_by_pk?: Maybe<User_Uploads>;
  /** fetch data from the table in a streaming manner: "user_uploads" */
  user_uploads_stream: Array<User_Uploads>;
  /** An array relationship */
  users: Array<Users>;
  /** An aggregate relationship */
  users_aggregate: Users_Aggregate;
  /** fetch data from the table: "users" using primary key columns */
  users_by_pk?: Maybe<Users>;
  /** fetch data from the table in a streaming manner: "users" */
  users_stream: Array<Users>;
  /** fetch data from the table: "vehicle_types" */
  vehicle_types: Array<Vehicle_Types>;
  /** fetch aggregated fields from the table: "vehicle_types" */
  vehicle_types_aggregate: Vehicle_Types_Aggregate;
  /** fetch data from the table: "vehicle_types" using primary key columns */
  vehicle_types_by_pk?: Maybe<Vehicle_Types>;
  /** fetch data from the table in a streaming manner: "vehicle_types" */
  vehicle_types_stream: Array<Vehicle_Types>;
};


export type Subscription_RootAccount_TransactionsArgs = {
  distinct_on?: InputMaybe<Array<Account_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Account_Transactions_Order_By>>;
  where?: InputMaybe<Account_Transactions_Bool_Exp>;
};


export type Subscription_RootAccount_Transactions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Account_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Account_Transactions_Order_By>>;
  where?: InputMaybe<Account_Transactions_Bool_Exp>;
};


export type Subscription_RootAccount_Transactions_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootAccount_Transactions_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Account_Transactions_Stream_Cursor_Input>>;
  where?: InputMaybe<Account_Transactions_Bool_Exp>;
};


export type Subscription_RootAccountsArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};


export type Subscription_RootAccounts_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};


export type Subscription_RootAccounts_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootAccounts_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Accounts_Stream_Cursor_Input>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};


export type Subscription_RootAddressesArgs = {
  distinct_on?: InputMaybe<Array<Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Addresses_Order_By>>;
  where?: InputMaybe<Addresses_Bool_Exp>;
};


export type Subscription_RootAddresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Addresses_Order_By>>;
  where?: InputMaybe<Addresses_Bool_Exp>;
};


export type Subscription_RootAddresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootAddresses_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Addresses_Stream_Cursor_Input>>;
  where?: InputMaybe<Addresses_Bool_Exp>;
};


export type Subscription_RootAgent_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agent_Addresses_Order_By>>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};


export type Subscription_RootAgent_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Agent_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agent_Addresses_Order_By>>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};


export type Subscription_RootAgent_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootAgent_Addresses_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Agent_Addresses_Stream_Cursor_Input>>;
  where?: InputMaybe<Agent_Addresses_Bool_Exp>;
};


export type Subscription_RootAgentsArgs = {
  distinct_on?: InputMaybe<Array<Agents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agents_Order_By>>;
  where?: InputMaybe<Agents_Bool_Exp>;
};


export type Subscription_RootAgents_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Agents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agents_Order_By>>;
  where?: InputMaybe<Agents_Bool_Exp>;
};


export type Subscription_RootAgents_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootAgents_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Agents_Stream_Cursor_Input>>;
  where?: InputMaybe<Agents_Bool_Exp>;
};


export type Subscription_RootAirtel_Money_PaymentsArgs = {
  distinct_on?: InputMaybe<Array<Airtel_Money_Payments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Airtel_Money_Payments_Order_By>>;
  where?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
};


export type Subscription_RootAirtel_Money_Payments_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Airtel_Money_Payments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Airtel_Money_Payments_Order_By>>;
  where?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
};


export type Subscription_RootAirtel_Money_Payments_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootAirtel_Money_Payments_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Airtel_Money_Payments_Stream_Cursor_Input>>;
  where?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
};


export type Subscription_RootApplication_ConfigurationsArgs = {
  distinct_on?: InputMaybe<Array<Application_Configurations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Application_Configurations_Order_By>>;
  where?: InputMaybe<Application_Configurations_Bool_Exp>;
};


export type Subscription_RootApplication_Configurations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Application_Configurations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Application_Configurations_Order_By>>;
  where?: InputMaybe<Application_Configurations_Bool_Exp>;
};


export type Subscription_RootApplication_Configurations_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootApplication_Configurations_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Application_Configurations_Stream_Cursor_Input>>;
  where?: InputMaybe<Application_Configurations_Bool_Exp>;
};


export type Subscription_RootBrandsArgs = {
  distinct_on?: InputMaybe<Array<Brands_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Brands_Order_By>>;
  where?: InputMaybe<Brands_Bool_Exp>;
};


export type Subscription_RootBrands_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Brands_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Brands_Order_By>>;
  where?: InputMaybe<Brands_Bool_Exp>;
};


export type Subscription_RootBrands_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootBrands_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Brands_Stream_Cursor_Input>>;
  where?: InputMaybe<Brands_Bool_Exp>;
};


export type Subscription_RootBusiness_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Addresses_Order_By>>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};


export type Subscription_RootBusiness_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Addresses_Order_By>>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};


export type Subscription_RootBusiness_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootBusiness_Addresses_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Business_Addresses_Stream_Cursor_Input>>;
  where?: InputMaybe<Business_Addresses_Bool_Exp>;
};


export type Subscription_RootBusiness_InventoryArgs = {
  distinct_on?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Inventory_Order_By>>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};


export type Subscription_RootBusiness_Inventory_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Inventory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Inventory_Order_By>>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};


export type Subscription_RootBusiness_Inventory_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootBusiness_Inventory_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Business_Inventory_Stream_Cursor_Input>>;
  where?: InputMaybe<Business_Inventory_Bool_Exp>;
};


export type Subscription_RootBusiness_LocationsArgs = {
  distinct_on?: InputMaybe<Array<Business_Locations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Locations_Order_By>>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};


export type Subscription_RootBusiness_Locations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Business_Locations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Business_Locations_Order_By>>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};


export type Subscription_RootBusiness_Locations_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootBusiness_Locations_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Business_Locations_Stream_Cursor_Input>>;
  where?: InputMaybe<Business_Locations_Bool_Exp>;
};


export type Subscription_RootBusinessesArgs = {
  distinct_on?: InputMaybe<Array<Businesses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Businesses_Order_By>>;
  where?: InputMaybe<Businesses_Bool_Exp>;
};


export type Subscription_RootBusinesses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Businesses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Businesses_Order_By>>;
  where?: InputMaybe<Businesses_Bool_Exp>;
};


export type Subscription_RootBusinesses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootBusinesses_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Businesses_Stream_Cursor_Input>>;
  where?: InputMaybe<Businesses_Bool_Exp>;
};


export type Subscription_RootClient_AddressesArgs = {
  distinct_on?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Client_Addresses_Order_By>>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};


export type Subscription_RootClient_Addresses_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Client_Addresses_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Client_Addresses_Order_By>>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};


export type Subscription_RootClient_Addresses_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootClient_Addresses_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Client_Addresses_Stream_Cursor_Input>>;
  where?: InputMaybe<Client_Addresses_Bool_Exp>;
};


export type Subscription_RootClientsArgs = {
  distinct_on?: InputMaybe<Array<Clients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Clients_Order_By>>;
  where?: InputMaybe<Clients_Bool_Exp>;
};


export type Subscription_RootClients_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Clients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Clients_Order_By>>;
  where?: InputMaybe<Clients_Bool_Exp>;
};


export type Subscription_RootClients_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootClients_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Clients_Stream_Cursor_Input>>;
  where?: InputMaybe<Clients_Bool_Exp>;
};


export type Subscription_RootDelivery_FeesArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Fees_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Fees_Order_By>>;
  where?: InputMaybe<Delivery_Fees_Bool_Exp>;
};


export type Subscription_RootDelivery_Fees_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Fees_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Fees_Order_By>>;
  where?: InputMaybe<Delivery_Fees_Bool_Exp>;
};


export type Subscription_RootDelivery_Fees_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootDelivery_Fees_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Delivery_Fees_Stream_Cursor_Input>>;
  where?: InputMaybe<Delivery_Fees_Bool_Exp>;
};


export type Subscription_RootDelivery_Time_SlotsArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Slots_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Slots_Order_By>>;
  where?: InputMaybe<Delivery_Time_Slots_Bool_Exp>;
};


export type Subscription_RootDelivery_Time_Slots_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Slots_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Slots_Order_By>>;
  where?: InputMaybe<Delivery_Time_Slots_Bool_Exp>;
};


export type Subscription_RootDelivery_Time_Slots_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootDelivery_Time_Slots_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Delivery_Time_Slots_Stream_Cursor_Input>>;
  where?: InputMaybe<Delivery_Time_Slots_Bool_Exp>;
};


export type Subscription_RootDelivery_Time_WindowsArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


export type Subscription_RootDelivery_Time_Windows_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


export type Subscription_RootDelivery_Time_Windows_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootDelivery_Time_Windows_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Delivery_Time_Windows_Stream_Cursor_Input>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


export type Subscription_RootDocument_TypesArgs = {
  distinct_on?: InputMaybe<Array<Document_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Document_Types_Order_By>>;
  where?: InputMaybe<Document_Types_Bool_Exp>;
};


export type Subscription_RootDocument_Types_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Document_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Document_Types_Order_By>>;
  where?: InputMaybe<Document_Types_Bool_Exp>;
};


export type Subscription_RootDocument_Types_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Subscription_RootDocument_Types_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Document_Types_Stream_Cursor_Input>>;
  where?: InputMaybe<Document_Types_Bool_Exp>;
};


export type Subscription_RootEntity_TypesArgs = {
  distinct_on?: InputMaybe<Array<Entity_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Entity_Types_Order_By>>;
  where?: InputMaybe<Entity_Types_Bool_Exp>;
};


export type Subscription_RootEntity_Types_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Entity_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Entity_Types_Order_By>>;
  where?: InputMaybe<Entity_Types_Bool_Exp>;
};


export type Subscription_RootEntity_Types_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootEntity_Types_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Entity_Types_Stream_Cursor_Input>>;
  where?: InputMaybe<Entity_Types_Bool_Exp>;
};


export type Subscription_RootGoogle_Distance_CacheArgs = {
  distinct_on?: InputMaybe<Array<Google_Distance_Cache_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Google_Distance_Cache_Order_By>>;
  where?: InputMaybe<Google_Distance_Cache_Bool_Exp>;
};


export type Subscription_RootGoogle_Distance_Cache_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Google_Distance_Cache_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Google_Distance_Cache_Order_By>>;
  where?: InputMaybe<Google_Distance_Cache_Bool_Exp>;
};


export type Subscription_RootGoogle_Distance_Cache_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootGoogle_Distance_Cache_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Google_Distance_Cache_Stream_Cursor_Input>>;
  where?: InputMaybe<Google_Distance_Cache_Bool_Exp>;
};


export type Subscription_RootGoogle_Geocode_CacheArgs = {
  distinct_on?: InputMaybe<Array<Google_Geocode_Cache_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Google_Geocode_Cache_Order_By>>;
  where?: InputMaybe<Google_Geocode_Cache_Bool_Exp>;
};


export type Subscription_RootGoogle_Geocode_Cache_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Google_Geocode_Cache_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Google_Geocode_Cache_Order_By>>;
  where?: InputMaybe<Google_Geocode_Cache_Bool_Exp>;
};


export type Subscription_RootGoogle_Geocode_Cache_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootGoogle_Geocode_Cache_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Google_Geocode_Cache_Stream_Cursor_Input>>;
  where?: InputMaybe<Google_Geocode_Cache_Bool_Exp>;
};


export type Subscription_RootItem_CategoriesArgs = {
  distinct_on?: InputMaybe<Array<Item_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Categories_Order_By>>;
  where?: InputMaybe<Item_Categories_Bool_Exp>;
};


export type Subscription_RootItem_Categories_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Item_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Categories_Order_By>>;
  where?: InputMaybe<Item_Categories_Bool_Exp>;
};


export type Subscription_RootItem_Categories_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Subscription_RootItem_Categories_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Item_Categories_Stream_Cursor_Input>>;
  where?: InputMaybe<Item_Categories_Bool_Exp>;
};


export type Subscription_RootItem_ImagesArgs = {
  distinct_on?: InputMaybe<Array<Item_Images_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Images_Order_By>>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};


export type Subscription_RootItem_Images_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Item_Images_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Images_Order_By>>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};


export type Subscription_RootItem_Images_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootItem_Images_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Item_Images_Stream_Cursor_Input>>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};


export type Subscription_RootItem_Sub_CategoriesArgs = {
  distinct_on?: InputMaybe<Array<Item_Sub_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Sub_Categories_Order_By>>;
  where?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
};


export type Subscription_RootItem_Sub_Categories_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Item_Sub_Categories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Sub_Categories_Order_By>>;
  where?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
};


export type Subscription_RootItem_Sub_Categories_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Subscription_RootItem_Sub_Categories_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Item_Sub_Categories_Stream_Cursor_Input>>;
  where?: InputMaybe<Item_Sub_Categories_Bool_Exp>;
};


export type Subscription_RootItemsArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};


export type Subscription_RootItems_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Items_Order_By>>;
  where?: InputMaybe<Items_Bool_Exp>;
};


export type Subscription_RootItems_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootItems_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Items_Stream_Cursor_Input>>;
  where?: InputMaybe<Items_Bool_Exp>;
};


export type Subscription_RootMobile_Payment_TransactionsArgs = {
  distinct_on?: InputMaybe<Array<Mobile_Payment_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mobile_Payment_Transactions_Order_By>>;
  where?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
};


export type Subscription_RootMobile_Payment_Transactions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mobile_Payment_Transactions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mobile_Payment_Transactions_Order_By>>;
  where?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
};


export type Subscription_RootMobile_Payment_Transactions_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootMobile_Payment_Transactions_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Mobile_Payment_Transactions_Stream_Cursor_Input>>;
  where?: InputMaybe<Mobile_Payment_Transactions_Bool_Exp>;
};


export type Subscription_RootMtn_Momo_Payment_RequestsArgs = {
  distinct_on?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Order_By>>;
  where?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
};


export type Subscription_RootMtn_Momo_Payment_Requests_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Order_By>>;
  where?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
};


export type Subscription_RootMtn_Momo_Payment_Requests_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootMtn_Momo_Payment_Requests_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Mtn_Momo_Payment_Requests_Stream_Cursor_Input>>;
  where?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
};


export type Subscription_RootOrder_Cancellation_ReasonsArgs = {
  distinct_on?: InputMaybe<Array<Order_Cancellation_Reasons_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Cancellation_Reasons_Order_By>>;
  where?: InputMaybe<Order_Cancellation_Reasons_Bool_Exp>;
};


export type Subscription_RootOrder_Cancellation_Reasons_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Cancellation_Reasons_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Cancellation_Reasons_Order_By>>;
  where?: InputMaybe<Order_Cancellation_Reasons_Bool_Exp>;
};


export type Subscription_RootOrder_Cancellation_Reasons_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Subscription_RootOrder_Cancellation_Reasons_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Order_Cancellation_Reasons_Stream_Cursor_Input>>;
  where?: InputMaybe<Order_Cancellation_Reasons_Bool_Exp>;
};


export type Subscription_RootOrder_HoldsArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


export type Subscription_RootOrder_Holds_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Holds_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Holds_Order_By>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


export type Subscription_RootOrder_Holds_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootOrder_Holds_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Order_Holds_Stream_Cursor_Input>>;
  where?: InputMaybe<Order_Holds_Bool_Exp>;
};


export type Subscription_RootOrder_ItemsArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


export type Subscription_RootOrder_Items_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Items_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Items_Order_By>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


export type Subscription_RootOrder_Items_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootOrder_Items_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Order_Items_Stream_Cursor_Input>>;
  where?: InputMaybe<Order_Items_Bool_Exp>;
};


export type Subscription_RootOrder_Status_HistoryArgs = {
  distinct_on?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Status_History_Order_By>>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};


export type Subscription_RootOrder_Status_History_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Status_History_Order_By>>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};


export type Subscription_RootOrder_Status_History_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootOrder_Status_History_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Order_Status_History_Stream_Cursor_Input>>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};


export type Subscription_RootOrdersArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


export type Subscription_RootOrders_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Orders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Orders_Order_By>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


export type Subscription_RootOrders_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootOrders_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Orders_Stream_Cursor_Input>>;
  where?: InputMaybe<Orders_Bool_Exp>;
};


export type Subscription_RootPayment_CallbacksArgs = {
  distinct_on?: InputMaybe<Array<Payment_Callbacks_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Payment_Callbacks_Order_By>>;
  where?: InputMaybe<Payment_Callbacks_Bool_Exp>;
};


export type Subscription_RootPayment_Callbacks_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Payment_Callbacks_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Payment_Callbacks_Order_By>>;
  where?: InputMaybe<Payment_Callbacks_Bool_Exp>;
};


export type Subscription_RootPayment_Callbacks_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootPayment_Callbacks_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Payment_Callbacks_Stream_Cursor_Input>>;
  where?: InputMaybe<Payment_Callbacks_Bool_Exp>;
};


export type Subscription_RootRating_AggregatesArgs = {
  distinct_on?: InputMaybe<Array<Rating_Aggregates_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Rating_Aggregates_Order_By>>;
  where?: InputMaybe<Rating_Aggregates_Bool_Exp>;
};


export type Subscription_RootRating_Aggregates_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Rating_Aggregates_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Rating_Aggregates_Order_By>>;
  where?: InputMaybe<Rating_Aggregates_Bool_Exp>;
};


export type Subscription_RootRating_Aggregates_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootRating_Aggregates_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Rating_Aggregates_Stream_Cursor_Input>>;
  where?: InputMaybe<Rating_Aggregates_Bool_Exp>;
};


export type Subscription_RootRatingsArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


export type Subscription_RootRatings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


export type Subscription_RootRatings_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootRatings_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Ratings_Stream_Cursor_Input>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


export type Subscription_RootSupported_Payment_SystemsArgs = {
  distinct_on?: InputMaybe<Array<Supported_Payment_Systems_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Supported_Payment_Systems_Order_By>>;
  where?: InputMaybe<Supported_Payment_Systems_Bool_Exp>;
};


export type Subscription_RootSupported_Payment_Systems_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Supported_Payment_Systems_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Supported_Payment_Systems_Order_By>>;
  where?: InputMaybe<Supported_Payment_Systems_Bool_Exp>;
};


export type Subscription_RootSupported_Payment_Systems_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootSupported_Payment_Systems_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Supported_Payment_Systems_Stream_Cursor_Input>>;
  where?: InputMaybe<Supported_Payment_Systems_Bool_Exp>;
};


export type Subscription_RootUser_MessagesArgs = {
  distinct_on?: InputMaybe<Array<User_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Messages_Order_By>>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};


export type Subscription_RootUser_Messages_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Messages_Order_By>>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};


export type Subscription_RootUser_Messages_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootUser_Messages_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<User_Messages_Stream_Cursor_Input>>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};


export type Subscription_RootUser_TypesArgs = {
  distinct_on?: InputMaybe<Array<User_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Types_Order_By>>;
  where?: InputMaybe<User_Types_Bool_Exp>;
};


export type Subscription_RootUser_Types_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Types_Order_By>>;
  where?: InputMaybe<User_Types_Bool_Exp>;
};


export type Subscription_RootUser_Types_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootUser_Types_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<User_Types_Stream_Cursor_Input>>;
  where?: InputMaybe<User_Types_Bool_Exp>;
};


export type Subscription_RootUser_UploadsArgs = {
  distinct_on?: InputMaybe<Array<User_Uploads_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Uploads_Order_By>>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};


export type Subscription_RootUser_Uploads_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Uploads_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Uploads_Order_By>>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};


export type Subscription_RootUser_Uploads_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootUser_Uploads_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<User_Uploads_Stream_Cursor_Input>>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};


export type Subscription_RootUsersArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Subscription_RootUsers_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Subscription_RootUsers_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootUsers_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Users_Stream_Cursor_Input>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Subscription_RootVehicle_TypesArgs = {
  distinct_on?: InputMaybe<Array<Vehicle_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Vehicle_Types_Order_By>>;
  where?: InputMaybe<Vehicle_Types_Bool_Exp>;
};


export type Subscription_RootVehicle_Types_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Vehicle_Types_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Vehicle_Types_Order_By>>;
  where?: InputMaybe<Vehicle_Types_Bool_Exp>;
};


export type Subscription_RootVehicle_Types_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootVehicle_Types_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Vehicle_Types_Stream_Cursor_Input>>;
  where?: InputMaybe<Vehicle_Types_Bool_Exp>;
};

/** columns and relationships of "supported_payment_systems" */
export type Supported_Payment_Systems = {
  __typename?: 'supported_payment_systems';
  active: Scalars['Boolean']['output'];
  country: Scalars['bpchar']['output'];
  created_at: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  name: Scalars['String']['output'];
  updated_at: Scalars['timestamptz']['output'];
};

/** aggregated selection of "supported_payment_systems" */
export type Supported_Payment_Systems_Aggregate = {
  __typename?: 'supported_payment_systems_aggregate';
  aggregate?: Maybe<Supported_Payment_Systems_Aggregate_Fields>;
  nodes: Array<Supported_Payment_Systems>;
};

/** aggregate fields of "supported_payment_systems" */
export type Supported_Payment_Systems_Aggregate_Fields = {
  __typename?: 'supported_payment_systems_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Supported_Payment_Systems_Max_Fields>;
  min?: Maybe<Supported_Payment_Systems_Min_Fields>;
};


/** aggregate fields of "supported_payment_systems" */
export type Supported_Payment_Systems_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Supported_Payment_Systems_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "supported_payment_systems". All fields are combined with a logical 'AND'. */
export type Supported_Payment_Systems_Bool_Exp = {
  _and?: InputMaybe<Array<Supported_Payment_Systems_Bool_Exp>>;
  _not?: InputMaybe<Supported_Payment_Systems_Bool_Exp>;
  _or?: InputMaybe<Array<Supported_Payment_Systems_Bool_Exp>>;
  active?: InputMaybe<Boolean_Comparison_Exp>;
  country?: InputMaybe<Bpchar_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "supported_payment_systems" */
export enum Supported_Payment_Systems_Constraint {
  /** unique or primary key constraint on columns "id" */
  SupportedPaymentSystemsPkey = 'supported_payment_systems_pkey',
  /** unique or primary key constraint on columns "country", "name" */
  UniquePaymentSystemCountry = 'unique_payment_system_country'
}

/** input type for inserting data into table "supported_payment_systems" */
export type Supported_Payment_Systems_Insert_Input = {
  active?: InputMaybe<Scalars['Boolean']['input']>;
  country?: InputMaybe<Scalars['bpchar']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate max on columns */
export type Supported_Payment_Systems_Max_Fields = {
  __typename?: 'supported_payment_systems_max_fields';
  country?: Maybe<Scalars['bpchar']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregate min on columns */
export type Supported_Payment_Systems_Min_Fields = {
  __typename?: 'supported_payment_systems_min_fields';
  country?: Maybe<Scalars['bpchar']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** response of any mutation on the table "supported_payment_systems" */
export type Supported_Payment_Systems_Mutation_Response = {
  __typename?: 'supported_payment_systems_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Supported_Payment_Systems>;
};

/** on_conflict condition type for table "supported_payment_systems" */
export type Supported_Payment_Systems_On_Conflict = {
  constraint: Supported_Payment_Systems_Constraint;
  update_columns?: Array<Supported_Payment_Systems_Update_Column>;
  where?: InputMaybe<Supported_Payment_Systems_Bool_Exp>;
};

/** Ordering options when selecting data from "supported_payment_systems". */
export type Supported_Payment_Systems_Order_By = {
  active?: InputMaybe<Order_By>;
  country?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** primary key columns input for table: supported_payment_systems */
export type Supported_Payment_Systems_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "supported_payment_systems" */
export enum Supported_Payment_Systems_Select_Column {
  /** column name */
  Active = 'active',
  /** column name */
  Country = 'country',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updated_at'
}

/** input type for updating data in table "supported_payment_systems" */
export type Supported_Payment_Systems_Set_Input = {
  active?: InputMaybe<Scalars['Boolean']['input']>;
  country?: InputMaybe<Scalars['bpchar']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** Streaming cursor of the table "supported_payment_systems" */
export type Supported_Payment_Systems_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Supported_Payment_Systems_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Supported_Payment_Systems_Stream_Cursor_Value_Input = {
  active?: InputMaybe<Scalars['Boolean']['input']>;
  country?: InputMaybe<Scalars['bpchar']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** update columns of table "supported_payment_systems" */
export enum Supported_Payment_Systems_Update_Column {
  /** column name */
  Active = 'active',
  /** column name */
  Country = 'country',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updated_at'
}

export type Supported_Payment_Systems_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Supported_Payment_Systems_Set_Input>;
  /** filter the rows which have to be updated */
  where: Supported_Payment_Systems_Bool_Exp;
};

/** Boolean expression to compare columns of type "time". All fields are combined with logical 'AND'. */
export type Time_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['time']['input']>;
  _gt?: InputMaybe<Scalars['time']['input']>;
  _gte?: InputMaybe<Scalars['time']['input']>;
  _in?: InputMaybe<Array<Scalars['time']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['time']['input']>;
  _lte?: InputMaybe<Scalars['time']['input']>;
  _neq?: InputMaybe<Scalars['time']['input']>;
  _nin?: InputMaybe<Array<Scalars['time']['input']>>;
};

/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export type Timestamptz_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['timestamptz']['input']>;
  _gt?: InputMaybe<Scalars['timestamptz']['input']>;
  _gte?: InputMaybe<Scalars['timestamptz']['input']>;
  _in?: InputMaybe<Array<Scalars['timestamptz']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['timestamptz']['input']>;
  _lte?: InputMaybe<Scalars['timestamptz']['input']>;
  _neq?: InputMaybe<Scalars['timestamptz']['input']>;
  _nin?: InputMaybe<Array<Scalars['timestamptz']['input']>>;
};

/** Boolean expression to compare columns of type "transaction_type_enum". All fields are combined with logical 'AND'. */
export type Transaction_Type_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['transaction_type_enum']['input']>;
  _gt?: InputMaybe<Scalars['transaction_type_enum']['input']>;
  _gte?: InputMaybe<Scalars['transaction_type_enum']['input']>;
  _in?: InputMaybe<Array<Scalars['transaction_type_enum']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['transaction_type_enum']['input']>;
  _lte?: InputMaybe<Scalars['transaction_type_enum']['input']>;
  _neq?: InputMaybe<Scalars['transaction_type_enum']['input']>;
  _nin?: InputMaybe<Array<Scalars['transaction_type_enum']['input']>>;
};

/** columns and relationships of "user_messages" */
export type User_Messages = {
  __typename?: 'user_messages';
  created_at: Scalars['timestamptz']['output'];
  entity_id: Scalars['uuid']['output'];
  entity_type: Entity_Types_Enum;
  /** An object relationship */
  entity_type_info?: Maybe<Entity_Types>;
  id: Scalars['uuid']['output'];
  message: Scalars['String']['output'];
  updated_at: Scalars['timestamptz']['output'];
  /** An object relationship */
  user?: Maybe<Users>;
  user_id: Scalars['uuid']['output'];
};

/** aggregated selection of "user_messages" */
export type User_Messages_Aggregate = {
  __typename?: 'user_messages_aggregate';
  aggregate?: Maybe<User_Messages_Aggregate_Fields>;
  nodes: Array<User_Messages>;
};

export type User_Messages_Aggregate_Bool_Exp = {
  count?: InputMaybe<User_Messages_Aggregate_Bool_Exp_Count>;
};

export type User_Messages_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<User_Messages_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<User_Messages_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "user_messages" */
export type User_Messages_Aggregate_Fields = {
  __typename?: 'user_messages_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<User_Messages_Max_Fields>;
  min?: Maybe<User_Messages_Min_Fields>;
};


/** aggregate fields of "user_messages" */
export type User_Messages_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<User_Messages_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "user_messages" */
export type User_Messages_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<User_Messages_Max_Order_By>;
  min?: InputMaybe<User_Messages_Min_Order_By>;
};

/** input type for inserting array relation for remote table "user_messages" */
export type User_Messages_Arr_Rel_Insert_Input = {
  data: Array<User_Messages_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<User_Messages_On_Conflict>;
};

/** Boolean expression to filter rows from the table "user_messages". All fields are combined with a logical 'AND'. */
export type User_Messages_Bool_Exp = {
  _and?: InputMaybe<Array<User_Messages_Bool_Exp>>;
  _not?: InputMaybe<User_Messages_Bool_Exp>;
  _or?: InputMaybe<Array<User_Messages_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  entity_id?: InputMaybe<Uuid_Comparison_Exp>;
  entity_type?: InputMaybe<Entity_Types_Enum_Comparison_Exp>;
  entity_type_info?: InputMaybe<Entity_Types_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  message?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "user_messages" */
export enum User_Messages_Constraint {
  /** unique or primary key constraint on columns "id" */
  UserMessagesPkey = 'user_messages_pkey'
}

/** input type for inserting data into table "user_messages" */
export type User_Messages_Insert_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  entity_id?: InputMaybe<Scalars['uuid']['input']>;
  entity_type?: InputMaybe<Entity_Types_Enum>;
  entity_type_info?: InputMaybe<Entity_Types_Obj_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type User_Messages_Max_Fields = {
  __typename?: 'user_messages_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  entity_id?: Maybe<Scalars['uuid']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "user_messages" */
export type User_Messages_Max_Order_By = {
  created_at?: InputMaybe<Order_By>;
  entity_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type User_Messages_Min_Fields = {
  __typename?: 'user_messages_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  entity_id?: Maybe<Scalars['uuid']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "user_messages" */
export type User_Messages_Min_Order_By = {
  created_at?: InputMaybe<Order_By>;
  entity_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "user_messages" */
export type User_Messages_Mutation_Response = {
  __typename?: 'user_messages_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<User_Messages>;
};

/** on_conflict condition type for table "user_messages" */
export type User_Messages_On_Conflict = {
  constraint: User_Messages_Constraint;
  update_columns?: Array<User_Messages_Update_Column>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};

/** Ordering options when selecting data from "user_messages". */
export type User_Messages_Order_By = {
  created_at?: InputMaybe<Order_By>;
  entity_id?: InputMaybe<Order_By>;
  entity_type?: InputMaybe<Order_By>;
  entity_type_info?: InputMaybe<Entity_Types_Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: user_messages */
export type User_Messages_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "user_messages" */
export enum User_Messages_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  EntityId = 'entity_id',
  /** column name */
  EntityType = 'entity_type',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

/** input type for updating data in table "user_messages" */
export type User_Messages_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  entity_id?: InputMaybe<Scalars['uuid']['input']>;
  entity_type?: InputMaybe<Entity_Types_Enum>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** Streaming cursor of the table "user_messages" */
export type User_Messages_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: User_Messages_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type User_Messages_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  entity_id?: InputMaybe<Scalars['uuid']['input']>;
  entity_type?: InputMaybe<Entity_Types_Enum>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "user_messages" */
export enum User_Messages_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  EntityId = 'entity_id',
  /** column name */
  EntityType = 'entity_type',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

export type User_Messages_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<User_Messages_Set_Input>;
  /** filter the rows which have to be updated */
  where: User_Messages_Bool_Exp;
};

/** columns and relationships of "user_types" */
export type User_Types = {
  __typename?: 'user_types';
  comment: Scalars['String']['output'];
  id: Scalars['String']['output'];
  /** An array relationship */
  users: Array<Users>;
  /** An aggregate relationship */
  users_aggregate: Users_Aggregate;
};


/** columns and relationships of "user_types" */
export type User_TypesUsersArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


/** columns and relationships of "user_types" */
export type User_TypesUsers_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};

/** aggregated selection of "user_types" */
export type User_Types_Aggregate = {
  __typename?: 'user_types_aggregate';
  aggregate?: Maybe<User_Types_Aggregate_Fields>;
  nodes: Array<User_Types>;
};

/** aggregate fields of "user_types" */
export type User_Types_Aggregate_Fields = {
  __typename?: 'user_types_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<User_Types_Max_Fields>;
  min?: Maybe<User_Types_Min_Fields>;
};


/** aggregate fields of "user_types" */
export type User_Types_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<User_Types_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "user_types". All fields are combined with a logical 'AND'. */
export type User_Types_Bool_Exp = {
  _and?: InputMaybe<Array<User_Types_Bool_Exp>>;
  _not?: InputMaybe<User_Types_Bool_Exp>;
  _or?: InputMaybe<Array<User_Types_Bool_Exp>>;
  comment?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  users?: InputMaybe<Users_Bool_Exp>;
  users_aggregate?: InputMaybe<Users_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "user_types" */
export enum User_Types_Constraint {
  /** unique or primary key constraint on columns "id" */
  UserTypesPkey = 'user_types_pkey'
}

export enum User_Types_Enum {
  /** Admin */
  Admin = 'admin',
  /** Agent */
  Agent = 'agent',
  /** Business */
  Business = 'business',
  /** Client */
  Client = 'client',
  /** Partner */
  Partner = 'partner'
}

/** Boolean expression to compare columns of type "user_types_enum". All fields are combined with logical 'AND'. */
export type User_Types_Enum_Comparison_Exp = {
  _eq?: InputMaybe<User_Types_Enum>;
  _in?: InputMaybe<Array<User_Types_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<User_Types_Enum>;
  _nin?: InputMaybe<Array<User_Types_Enum>>;
};

/** input type for inserting data into table "user_types" */
export type User_Types_Insert_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  users?: InputMaybe<Users_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type User_Types_Max_Fields = {
  __typename?: 'user_types_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type User_Types_Min_Fields = {
  __typename?: 'user_types_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "user_types" */
export type User_Types_Mutation_Response = {
  __typename?: 'user_types_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<User_Types>;
};

/** input type for inserting object relation for remote table "user_types" */
export type User_Types_Obj_Rel_Insert_Input = {
  data: User_Types_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<User_Types_On_Conflict>;
};

/** on_conflict condition type for table "user_types" */
export type User_Types_On_Conflict = {
  constraint: User_Types_Constraint;
  update_columns?: Array<User_Types_Update_Column>;
  where?: InputMaybe<User_Types_Bool_Exp>;
};

/** Ordering options when selecting data from "user_types". */
export type User_Types_Order_By = {
  comment?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  users_aggregate?: InputMaybe<Users_Aggregate_Order_By>;
};

/** primary key columns input for table: user_types */
export type User_Types_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "user_types" */
export enum User_Types_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Id = 'id'
}

/** input type for updating data in table "user_types" */
export type User_Types_Set_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "user_types" */
export type User_Types_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: User_Types_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type User_Types_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "user_types" */
export enum User_Types_Update_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Id = 'id'
}

export type User_Types_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<User_Types_Set_Input>;
  /** filter the rows which have to be updated */
  where: User_Types_Bool_Exp;
};

/** columns and relationships of "user_uploads" */
export type User_Uploads = {
  __typename?: 'user_uploads';
  content_type: Scalars['String']['output'];
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  /** An object relationship */
  document_type?: Maybe<Document_Types>;
  document_type_id: Scalars['Int']['output'];
  file_name: Scalars['String']['output'];
  file_size?: Maybe<Scalars['bigint']['output']>;
  id: Scalars['uuid']['output'];
  is_approved: Scalars['Boolean']['output'];
  key: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  /** An object relationship */
  user?: Maybe<Users>;
  user_id: Scalars['uuid']['output'];
};

/** aggregated selection of "user_uploads" */
export type User_Uploads_Aggregate = {
  __typename?: 'user_uploads_aggregate';
  aggregate?: Maybe<User_Uploads_Aggregate_Fields>;
  nodes: Array<User_Uploads>;
};

export type User_Uploads_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<User_Uploads_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<User_Uploads_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<User_Uploads_Aggregate_Bool_Exp_Count>;
};

export type User_Uploads_Aggregate_Bool_Exp_Bool_And = {
  arguments: User_Uploads_Select_Column_User_Uploads_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<User_Uploads_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type User_Uploads_Aggregate_Bool_Exp_Bool_Or = {
  arguments: User_Uploads_Select_Column_User_Uploads_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<User_Uploads_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type User_Uploads_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<User_Uploads_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<User_Uploads_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "user_uploads" */
export type User_Uploads_Aggregate_Fields = {
  __typename?: 'user_uploads_aggregate_fields';
  avg?: Maybe<User_Uploads_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<User_Uploads_Max_Fields>;
  min?: Maybe<User_Uploads_Min_Fields>;
  stddev?: Maybe<User_Uploads_Stddev_Fields>;
  stddev_pop?: Maybe<User_Uploads_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<User_Uploads_Stddev_Samp_Fields>;
  sum?: Maybe<User_Uploads_Sum_Fields>;
  var_pop?: Maybe<User_Uploads_Var_Pop_Fields>;
  var_samp?: Maybe<User_Uploads_Var_Samp_Fields>;
  variance?: Maybe<User_Uploads_Variance_Fields>;
};


/** aggregate fields of "user_uploads" */
export type User_Uploads_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<User_Uploads_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "user_uploads" */
export type User_Uploads_Aggregate_Order_By = {
  avg?: InputMaybe<User_Uploads_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<User_Uploads_Max_Order_By>;
  min?: InputMaybe<User_Uploads_Min_Order_By>;
  stddev?: InputMaybe<User_Uploads_Stddev_Order_By>;
  stddev_pop?: InputMaybe<User_Uploads_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<User_Uploads_Stddev_Samp_Order_By>;
  sum?: InputMaybe<User_Uploads_Sum_Order_By>;
  var_pop?: InputMaybe<User_Uploads_Var_Pop_Order_By>;
  var_samp?: InputMaybe<User_Uploads_Var_Samp_Order_By>;
  variance?: InputMaybe<User_Uploads_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "user_uploads" */
export type User_Uploads_Arr_Rel_Insert_Input = {
  data: Array<User_Uploads_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<User_Uploads_On_Conflict>;
};

/** aggregate avg on columns */
export type User_Uploads_Avg_Fields = {
  __typename?: 'user_uploads_avg_fields';
  document_type_id?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "user_uploads" */
export type User_Uploads_Avg_Order_By = {
  document_type_id?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "user_uploads". All fields are combined with a logical 'AND'. */
export type User_Uploads_Bool_Exp = {
  _and?: InputMaybe<Array<User_Uploads_Bool_Exp>>;
  _not?: InputMaybe<User_Uploads_Bool_Exp>;
  _or?: InputMaybe<Array<User_Uploads_Bool_Exp>>;
  content_type?: InputMaybe<String_Comparison_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  document_type?: InputMaybe<Document_Types_Bool_Exp>;
  document_type_id?: InputMaybe<Int_Comparison_Exp>;
  file_name?: InputMaybe<String_Comparison_Exp>;
  file_size?: InputMaybe<Bigint_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  is_approved?: InputMaybe<Boolean_Comparison_Exp>;
  key?: InputMaybe<String_Comparison_Exp>;
  note?: InputMaybe<String_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  user_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "user_uploads" */
export enum User_Uploads_Constraint {
  /** unique or primary key constraint on columns "id" */
  UserUploadsPkey = 'user_uploads_pkey'
}

/** input type for incrementing numeric columns in table "user_uploads" */
export type User_Uploads_Inc_Input = {
  document_type_id?: InputMaybe<Scalars['Int']['input']>;
  file_size?: InputMaybe<Scalars['bigint']['input']>;
};

/** input type for inserting data into table "user_uploads" */
export type User_Uploads_Insert_Input = {
  content_type?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  document_type?: InputMaybe<Document_Types_Obj_Rel_Insert_Input>;
  document_type_id?: InputMaybe<Scalars['Int']['input']>;
  file_name?: InputMaybe<Scalars['String']['input']>;
  file_size?: InputMaybe<Scalars['bigint']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_approved?: InputMaybe<Scalars['Boolean']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type User_Uploads_Max_Fields = {
  __typename?: 'user_uploads_max_fields';
  content_type?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  document_type_id?: Maybe<Scalars['Int']['output']>;
  file_name?: Maybe<Scalars['String']['output']>;
  file_size?: Maybe<Scalars['bigint']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  note?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "user_uploads" */
export type User_Uploads_Max_Order_By = {
  content_type?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  document_type_id?: InputMaybe<Order_By>;
  file_name?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  key?: InputMaybe<Order_By>;
  note?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type User_Uploads_Min_Fields = {
  __typename?: 'user_uploads_min_fields';
  content_type?: Maybe<Scalars['String']['output']>;
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  document_type_id?: Maybe<Scalars['Int']['output']>;
  file_name?: Maybe<Scalars['String']['output']>;
  file_size?: Maybe<Scalars['bigint']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  note?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
  user_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "user_uploads" */
export type User_Uploads_Min_Order_By = {
  content_type?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  document_type_id?: InputMaybe<Order_By>;
  file_name?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  key?: InputMaybe<Order_By>;
  note?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "user_uploads" */
export type User_Uploads_Mutation_Response = {
  __typename?: 'user_uploads_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<User_Uploads>;
};

/** on_conflict condition type for table "user_uploads" */
export type User_Uploads_On_Conflict = {
  constraint: User_Uploads_Constraint;
  update_columns?: Array<User_Uploads_Update_Column>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};

/** Ordering options when selecting data from "user_uploads". */
export type User_Uploads_Order_By = {
  content_type?: InputMaybe<Order_By>;
  created_at?: InputMaybe<Order_By>;
  document_type?: InputMaybe<Document_Types_Order_By>;
  document_type_id?: InputMaybe<Order_By>;
  file_name?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  is_approved?: InputMaybe<Order_By>;
  key?: InputMaybe<Order_By>;
  note?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: user_uploads */
export type User_Uploads_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "user_uploads" */
export enum User_Uploads_Select_Column {
  /** column name */
  ContentType = 'content_type',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  DocumentTypeId = 'document_type_id',
  /** column name */
  FileName = 'file_name',
  /** column name */
  FileSize = 'file_size',
  /** column name */
  Id = 'id',
  /** column name */
  IsApproved = 'is_approved',
  /** column name */
  Key = 'key',
  /** column name */
  Note = 'note',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

/** select "user_uploads_aggregate_bool_exp_bool_and_arguments_columns" columns of table "user_uploads" */
export enum User_Uploads_Select_Column_User_Uploads_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsApproved = 'is_approved'
}

/** select "user_uploads_aggregate_bool_exp_bool_or_arguments_columns" columns of table "user_uploads" */
export enum User_Uploads_Select_Column_User_Uploads_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsApproved = 'is_approved'
}

/** input type for updating data in table "user_uploads" */
export type User_Uploads_Set_Input = {
  content_type?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  document_type_id?: InputMaybe<Scalars['Int']['input']>;
  file_name?: InputMaybe<Scalars['String']['input']>;
  file_size?: InputMaybe<Scalars['bigint']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_approved?: InputMaybe<Scalars['Boolean']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate stddev on columns */
export type User_Uploads_Stddev_Fields = {
  __typename?: 'user_uploads_stddev_fields';
  document_type_id?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "user_uploads" */
export type User_Uploads_Stddev_Order_By = {
  document_type_id?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type User_Uploads_Stddev_Pop_Fields = {
  __typename?: 'user_uploads_stddev_pop_fields';
  document_type_id?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "user_uploads" */
export type User_Uploads_Stddev_Pop_Order_By = {
  document_type_id?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type User_Uploads_Stddev_Samp_Fields = {
  __typename?: 'user_uploads_stddev_samp_fields';
  document_type_id?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "user_uploads" */
export type User_Uploads_Stddev_Samp_Order_By = {
  document_type_id?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "user_uploads" */
export type User_Uploads_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: User_Uploads_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type User_Uploads_Stream_Cursor_Value_Input = {
  content_type?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  document_type_id?: InputMaybe<Scalars['Int']['input']>;
  file_name?: InputMaybe<Scalars['String']['input']>;
  file_size?: InputMaybe<Scalars['bigint']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  is_approved?: InputMaybe<Scalars['Boolean']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate sum on columns */
export type User_Uploads_Sum_Fields = {
  __typename?: 'user_uploads_sum_fields';
  document_type_id?: Maybe<Scalars['Int']['output']>;
  file_size?: Maybe<Scalars['bigint']['output']>;
};

/** order by sum() on columns of table "user_uploads" */
export type User_Uploads_Sum_Order_By = {
  document_type_id?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
};

/** update columns of table "user_uploads" */
export enum User_Uploads_Update_Column {
  /** column name */
  ContentType = 'content_type',
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  DocumentTypeId = 'document_type_id',
  /** column name */
  FileName = 'file_name',
  /** column name */
  FileSize = 'file_size',
  /** column name */
  Id = 'id',
  /** column name */
  IsApproved = 'is_approved',
  /** column name */
  Key = 'key',
  /** column name */
  Note = 'note',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserId = 'user_id'
}

export type User_Uploads_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<User_Uploads_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<User_Uploads_Set_Input>;
  /** filter the rows which have to be updated */
  where: User_Uploads_Bool_Exp;
};

/** aggregate var_pop on columns */
export type User_Uploads_Var_Pop_Fields = {
  __typename?: 'user_uploads_var_pop_fields';
  document_type_id?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "user_uploads" */
export type User_Uploads_Var_Pop_Order_By = {
  document_type_id?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type User_Uploads_Var_Samp_Fields = {
  __typename?: 'user_uploads_var_samp_fields';
  document_type_id?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "user_uploads" */
export type User_Uploads_Var_Samp_Order_By = {
  document_type_id?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type User_Uploads_Variance_Fields = {
  __typename?: 'user_uploads_variance_fields';
  document_type_id?: Maybe<Scalars['Float']['output']>;
  file_size?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "user_uploads" */
export type User_Uploads_Variance_Order_By = {
  document_type_id?: InputMaybe<Order_By>;
  file_size?: InputMaybe<Order_By>;
};

/** columns and relationships of "users" */
export type Users = {
  __typename?: 'users';
  /** An array relationship */
  accounts: Array<Accounts>;
  /** An aggregate relationship */
  accounts_aggregate: Accounts_Aggregate;
  /** An object relationship */
  agent?: Maybe<Agents>;
  /** An array relationship */
  airtel_money_payments: Array<Airtel_Money_Payments>;
  /** An aggregate relationship */
  airtel_money_payments_aggregate: Airtel_Money_Payments_Aggregate;
  /** An object relationship */
  business?: Maybe<Businesses>;
  /** An object relationship */
  client?: Maybe<Clients>;
  created_at: Scalars['timestamptz']['output'];
  /** An array relationship */
  delivery_time_windows_confirmed: Array<Delivery_Time_Windows>;
  /** An aggregate relationship */
  delivery_time_windows_confirmed_aggregate: Delivery_Time_Windows_Aggregate;
  email: Scalars['String']['output'];
  /** Whether the email has been verified */
  email_verified?: Maybe<Scalars['Boolean']['output']>;
  first_name: Scalars['String']['output'];
  id: Scalars['uuid']['output'];
  identifier: Scalars['String']['output'];
  /** An array relationship */
  item_images: Array<Item_Images>;
  /** An aggregate relationship */
  item_images_aggregate: Item_Images_Aggregate;
  last_name: Scalars['String']['output'];
  /** An array relationship */
  mtn_momo_payment_requests: Array<Mtn_Momo_Payment_Requests>;
  /** An aggregate relationship */
  mtn_momo_payment_requests_aggregate: Mtn_Momo_Payment_Requests_Aggregate;
  /** An array relationship */
  order_status_history: Array<Order_Status_History>;
  /** An aggregate relationship */
  order_status_history_aggregate: Order_Status_History_Aggregate;
  /** User phone number for contact and verification */
  phone_number?: Maybe<Scalars['String']['output']>;
  /** Whether the phone number has been verified */
  phone_number_verified?: Maybe<Scalars['Boolean']['output']>;
  /** An array relationship */
  ratings_given: Array<Ratings>;
  /** An aggregate relationship */
  ratings_given_aggregate: Ratings_Aggregate;
  updated_at: Scalars['timestamptz']['output'];
  /** An array relationship */
  user_messages: Array<User_Messages>;
  /** An aggregate relationship */
  user_messages_aggregate: User_Messages_Aggregate;
  /** An object relationship */
  user_type: User_Types;
  user_type_id: User_Types_Enum;
  /** An array relationship */
  user_uploads: Array<User_Uploads>;
  /** An aggregate relationship */
  user_uploads_aggregate: User_Uploads_Aggregate;
};


/** columns and relationships of "users" */
export type UsersAccountsArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersAccounts_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Accounts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Accounts_Order_By>>;
  where?: InputMaybe<Accounts_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersAirtel_Money_PaymentsArgs = {
  distinct_on?: InputMaybe<Array<Airtel_Money_Payments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Airtel_Money_Payments_Order_By>>;
  where?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersAirtel_Money_Payments_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Airtel_Money_Payments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Airtel_Money_Payments_Order_By>>;
  where?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersDelivery_Time_Windows_ConfirmedArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersDelivery_Time_Windows_Confirmed_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Delivery_Time_Windows_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Delivery_Time_Windows_Order_By>>;
  where?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersItem_ImagesArgs = {
  distinct_on?: InputMaybe<Array<Item_Images_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Images_Order_By>>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersItem_Images_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Item_Images_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Item_Images_Order_By>>;
  where?: InputMaybe<Item_Images_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersMtn_Momo_Payment_RequestsArgs = {
  distinct_on?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Order_By>>;
  where?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersMtn_Momo_Payment_Requests_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Mtn_Momo_Payment_Requests_Order_By>>;
  where?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersOrder_Status_HistoryArgs = {
  distinct_on?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Status_History_Order_By>>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersOrder_Status_History_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Order_Status_History_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Order_Status_History_Order_By>>;
  where?: InputMaybe<Order_Status_History_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersRatings_GivenArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersRatings_Given_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Ratings_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Ratings_Order_By>>;
  where?: InputMaybe<Ratings_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersUser_MessagesArgs = {
  distinct_on?: InputMaybe<Array<User_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Messages_Order_By>>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersUser_Messages_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Messages_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Messages_Order_By>>;
  where?: InputMaybe<User_Messages_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersUser_UploadsArgs = {
  distinct_on?: InputMaybe<Array<User_Uploads_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Uploads_Order_By>>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};


/** columns and relationships of "users" */
export type UsersUser_Uploads_AggregateArgs = {
  distinct_on?: InputMaybe<Array<User_Uploads_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<User_Uploads_Order_By>>;
  where?: InputMaybe<User_Uploads_Bool_Exp>;
};

/** aggregated selection of "users" */
export type Users_Aggregate = {
  __typename?: 'users_aggregate';
  aggregate?: Maybe<Users_Aggregate_Fields>;
  nodes: Array<Users>;
};

export type Users_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Users_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Users_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Users_Aggregate_Bool_Exp_Count>;
};

export type Users_Aggregate_Bool_Exp_Bool_And = {
  arguments: Users_Select_Column_Users_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Users_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Users_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Users_Select_Column_Users_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Users_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Users_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Users_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Users_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "users" */
export type Users_Aggregate_Fields = {
  __typename?: 'users_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Users_Max_Fields>;
  min?: Maybe<Users_Min_Fields>;
};


/** aggregate fields of "users" */
export type Users_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Users_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "users" */
export type Users_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Users_Max_Order_By>;
  min?: InputMaybe<Users_Min_Order_By>;
};

/** input type for inserting array relation for remote table "users" */
export type Users_Arr_Rel_Insert_Input = {
  data: Array<Users_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Users_On_Conflict>;
};

/** Boolean expression to filter rows from the table "users". All fields are combined with a logical 'AND'. */
export type Users_Bool_Exp = {
  _and?: InputMaybe<Array<Users_Bool_Exp>>;
  _not?: InputMaybe<Users_Bool_Exp>;
  _or?: InputMaybe<Array<Users_Bool_Exp>>;
  accounts?: InputMaybe<Accounts_Bool_Exp>;
  accounts_aggregate?: InputMaybe<Accounts_Aggregate_Bool_Exp>;
  agent?: InputMaybe<Agents_Bool_Exp>;
  airtel_money_payments?: InputMaybe<Airtel_Money_Payments_Bool_Exp>;
  airtel_money_payments_aggregate?: InputMaybe<Airtel_Money_Payments_Aggregate_Bool_Exp>;
  business?: InputMaybe<Businesses_Bool_Exp>;
  client?: InputMaybe<Clients_Bool_Exp>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  delivery_time_windows_confirmed?: InputMaybe<Delivery_Time_Windows_Bool_Exp>;
  delivery_time_windows_confirmed_aggregate?: InputMaybe<Delivery_Time_Windows_Aggregate_Bool_Exp>;
  email?: InputMaybe<String_Comparison_Exp>;
  email_verified?: InputMaybe<Boolean_Comparison_Exp>;
  first_name?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  identifier?: InputMaybe<String_Comparison_Exp>;
  item_images?: InputMaybe<Item_Images_Bool_Exp>;
  item_images_aggregate?: InputMaybe<Item_Images_Aggregate_Bool_Exp>;
  last_name?: InputMaybe<String_Comparison_Exp>;
  mtn_momo_payment_requests?: InputMaybe<Mtn_Momo_Payment_Requests_Bool_Exp>;
  mtn_momo_payment_requests_aggregate?: InputMaybe<Mtn_Momo_Payment_Requests_Aggregate_Bool_Exp>;
  order_status_history?: InputMaybe<Order_Status_History_Bool_Exp>;
  order_status_history_aggregate?: InputMaybe<Order_Status_History_Aggregate_Bool_Exp>;
  phone_number?: InputMaybe<String_Comparison_Exp>;
  phone_number_verified?: InputMaybe<Boolean_Comparison_Exp>;
  ratings_given?: InputMaybe<Ratings_Bool_Exp>;
  ratings_given_aggregate?: InputMaybe<Ratings_Aggregate_Bool_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  user_messages?: InputMaybe<User_Messages_Bool_Exp>;
  user_messages_aggregate?: InputMaybe<User_Messages_Aggregate_Bool_Exp>;
  user_type?: InputMaybe<User_Types_Bool_Exp>;
  user_type_id?: InputMaybe<User_Types_Enum_Comparison_Exp>;
  user_uploads?: InputMaybe<User_Uploads_Bool_Exp>;
  user_uploads_aggregate?: InputMaybe<User_Uploads_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "users" */
export enum Users_Constraint {
  /** unique or primary key constraint on columns "email" */
  UsersEmailKey = 'users_email_key',
  /** unique or primary key constraint on columns "identifier" */
  UsersIdentifierKey = 'users_identifier_key',
  /** unique or primary key constraint on columns "id" */
  UsersPkey = 'users_pkey'
}

/** input type for inserting data into table "users" */
export type Users_Insert_Input = {
  accounts?: InputMaybe<Accounts_Arr_Rel_Insert_Input>;
  agent?: InputMaybe<Agents_Obj_Rel_Insert_Input>;
  airtel_money_payments?: InputMaybe<Airtel_Money_Payments_Arr_Rel_Insert_Input>;
  business?: InputMaybe<Businesses_Obj_Rel_Insert_Input>;
  client?: InputMaybe<Clients_Obj_Rel_Insert_Input>;
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  delivery_time_windows_confirmed?: InputMaybe<Delivery_Time_Windows_Arr_Rel_Insert_Input>;
  email?: InputMaybe<Scalars['String']['input']>;
  /** Whether the email has been verified */
  email_verified?: InputMaybe<Scalars['Boolean']['input']>;
  first_name?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  identifier?: InputMaybe<Scalars['String']['input']>;
  item_images?: InputMaybe<Item_Images_Arr_Rel_Insert_Input>;
  last_name?: InputMaybe<Scalars['String']['input']>;
  mtn_momo_payment_requests?: InputMaybe<Mtn_Momo_Payment_Requests_Arr_Rel_Insert_Input>;
  order_status_history?: InputMaybe<Order_Status_History_Arr_Rel_Insert_Input>;
  /** User phone number for contact and verification */
  phone_number?: InputMaybe<Scalars['String']['input']>;
  /** Whether the phone number has been verified */
  phone_number_verified?: InputMaybe<Scalars['Boolean']['input']>;
  ratings_given?: InputMaybe<Ratings_Arr_Rel_Insert_Input>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_messages?: InputMaybe<User_Messages_Arr_Rel_Insert_Input>;
  user_type?: InputMaybe<User_Types_Obj_Rel_Insert_Input>;
  user_type_id?: InputMaybe<User_Types_Enum>;
  user_uploads?: InputMaybe<User_Uploads_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Users_Max_Fields = {
  __typename?: 'users_max_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  first_name?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  identifier?: Maybe<Scalars['String']['output']>;
  last_name?: Maybe<Scalars['String']['output']>;
  /** User phone number for contact and verification */
  phone_number?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "users" */
export type Users_Max_Order_By = {
  created_at?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  first_name?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  identifier?: InputMaybe<Order_By>;
  last_name?: InputMaybe<Order_By>;
  /** User phone number for contact and verification */
  phone_number?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Users_Min_Fields = {
  __typename?: 'users_min_fields';
  created_at?: Maybe<Scalars['timestamptz']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  first_name?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  identifier?: Maybe<Scalars['String']['output']>;
  last_name?: Maybe<Scalars['String']['output']>;
  /** User phone number for contact and verification */
  phone_number?: Maybe<Scalars['String']['output']>;
  updated_at?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "users" */
export type Users_Min_Order_By = {
  created_at?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  first_name?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  identifier?: InputMaybe<Order_By>;
  last_name?: InputMaybe<Order_By>;
  /** User phone number for contact and verification */
  phone_number?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "users" */
export type Users_Mutation_Response = {
  __typename?: 'users_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Users>;
};

/** input type for inserting object relation for remote table "users" */
export type Users_Obj_Rel_Insert_Input = {
  data: Users_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Users_On_Conflict>;
};

/** on_conflict condition type for table "users" */
export type Users_On_Conflict = {
  constraint: Users_Constraint;
  update_columns?: Array<Users_Update_Column>;
  where?: InputMaybe<Users_Bool_Exp>;
};

/** Ordering options when selecting data from "users". */
export type Users_Order_By = {
  accounts_aggregate?: InputMaybe<Accounts_Aggregate_Order_By>;
  agent?: InputMaybe<Agents_Order_By>;
  airtel_money_payments_aggregate?: InputMaybe<Airtel_Money_Payments_Aggregate_Order_By>;
  business?: InputMaybe<Businesses_Order_By>;
  client?: InputMaybe<Clients_Order_By>;
  created_at?: InputMaybe<Order_By>;
  delivery_time_windows_confirmed_aggregate?: InputMaybe<Delivery_Time_Windows_Aggregate_Order_By>;
  email?: InputMaybe<Order_By>;
  email_verified?: InputMaybe<Order_By>;
  first_name?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  identifier?: InputMaybe<Order_By>;
  item_images_aggregate?: InputMaybe<Item_Images_Aggregate_Order_By>;
  last_name?: InputMaybe<Order_By>;
  mtn_momo_payment_requests_aggregate?: InputMaybe<Mtn_Momo_Payment_Requests_Aggregate_Order_By>;
  order_status_history_aggregate?: InputMaybe<Order_Status_History_Aggregate_Order_By>;
  phone_number?: InputMaybe<Order_By>;
  phone_number_verified?: InputMaybe<Order_By>;
  ratings_given_aggregate?: InputMaybe<Ratings_Aggregate_Order_By>;
  updated_at?: InputMaybe<Order_By>;
  user_messages_aggregate?: InputMaybe<User_Messages_Aggregate_Order_By>;
  user_type?: InputMaybe<User_Types_Order_By>;
  user_type_id?: InputMaybe<Order_By>;
  user_uploads_aggregate?: InputMaybe<User_Uploads_Aggregate_Order_By>;
};

/** primary key columns input for table: users */
export type Users_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "users" */
export enum Users_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Email = 'email',
  /** column name */
  EmailVerified = 'email_verified',
  /** column name */
  FirstName = 'first_name',
  /** column name */
  Id = 'id',
  /** column name */
  Identifier = 'identifier',
  /** column name */
  LastName = 'last_name',
  /** column name */
  PhoneNumber = 'phone_number',
  /** column name */
  PhoneNumberVerified = 'phone_number_verified',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserTypeId = 'user_type_id'
}

/** select "users_aggregate_bool_exp_bool_and_arguments_columns" columns of table "users" */
export enum Users_Select_Column_Users_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  EmailVerified = 'email_verified',
  /** column name */
  PhoneNumberVerified = 'phone_number_verified'
}

/** select "users_aggregate_bool_exp_bool_or_arguments_columns" columns of table "users" */
export enum Users_Select_Column_Users_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  EmailVerified = 'email_verified',
  /** column name */
  PhoneNumberVerified = 'phone_number_verified'
}

/** input type for updating data in table "users" */
export type Users_Set_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  /** Whether the email has been verified */
  email_verified?: InputMaybe<Scalars['Boolean']['input']>;
  first_name?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  identifier?: InputMaybe<Scalars['String']['input']>;
  last_name?: InputMaybe<Scalars['String']['input']>;
  /** User phone number for contact and verification */
  phone_number?: InputMaybe<Scalars['String']['input']>;
  /** Whether the phone number has been verified */
  phone_number_verified?: InputMaybe<Scalars['Boolean']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_type_id?: InputMaybe<User_Types_Enum>;
};

/** Streaming cursor of the table "users" */
export type Users_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Users_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Users_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  /** Whether the email has been verified */
  email_verified?: InputMaybe<Scalars['Boolean']['input']>;
  first_name?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  identifier?: InputMaybe<Scalars['String']['input']>;
  last_name?: InputMaybe<Scalars['String']['input']>;
  /** User phone number for contact and verification */
  phone_number?: InputMaybe<Scalars['String']['input']>;
  /** Whether the phone number has been verified */
  phone_number_verified?: InputMaybe<Scalars['Boolean']['input']>;
  updated_at?: InputMaybe<Scalars['timestamptz']['input']>;
  user_type_id?: InputMaybe<User_Types_Enum>;
};

/** update columns of table "users" */
export enum Users_Update_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Email = 'email',
  /** column name */
  EmailVerified = 'email_verified',
  /** column name */
  FirstName = 'first_name',
  /** column name */
  Id = 'id',
  /** column name */
  Identifier = 'identifier',
  /** column name */
  LastName = 'last_name',
  /** column name */
  PhoneNumber = 'phone_number',
  /** column name */
  PhoneNumberVerified = 'phone_number_verified',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  UserTypeId = 'user_type_id'
}

export type Users_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Users_Set_Input>;
  /** filter the rows which have to be updated */
  where: Users_Bool_Exp;
};

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type Uuid_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['uuid']['input']>;
  _gt?: InputMaybe<Scalars['uuid']['input']>;
  _gte?: InputMaybe<Scalars['uuid']['input']>;
  _in?: InputMaybe<Array<Scalars['uuid']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['uuid']['input']>;
  _lte?: InputMaybe<Scalars['uuid']['input']>;
  _neq?: InputMaybe<Scalars['uuid']['input']>;
  _nin?: InputMaybe<Array<Scalars['uuid']['input']>>;
};

/** columns and relationships of "vehicle_types" */
export type Vehicle_Types = {
  __typename?: 'vehicle_types';
  /** An array relationship */
  agents: Array<Agents>;
  /** An aggregate relationship */
  agents_aggregate: Agents_Aggregate;
  comment: Scalars['String']['output'];
  id: Scalars['String']['output'];
};


/** columns and relationships of "vehicle_types" */
export type Vehicle_TypesAgentsArgs = {
  distinct_on?: InputMaybe<Array<Agents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agents_Order_By>>;
  where?: InputMaybe<Agents_Bool_Exp>;
};


/** columns and relationships of "vehicle_types" */
export type Vehicle_TypesAgents_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Agents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Agents_Order_By>>;
  where?: InputMaybe<Agents_Bool_Exp>;
};

/** aggregated selection of "vehicle_types" */
export type Vehicle_Types_Aggregate = {
  __typename?: 'vehicle_types_aggregate';
  aggregate?: Maybe<Vehicle_Types_Aggregate_Fields>;
  nodes: Array<Vehicle_Types>;
};

/** aggregate fields of "vehicle_types" */
export type Vehicle_Types_Aggregate_Fields = {
  __typename?: 'vehicle_types_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Vehicle_Types_Max_Fields>;
  min?: Maybe<Vehicle_Types_Min_Fields>;
};


/** aggregate fields of "vehicle_types" */
export type Vehicle_Types_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Vehicle_Types_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "vehicle_types". All fields are combined with a logical 'AND'. */
export type Vehicle_Types_Bool_Exp = {
  _and?: InputMaybe<Array<Vehicle_Types_Bool_Exp>>;
  _not?: InputMaybe<Vehicle_Types_Bool_Exp>;
  _or?: InputMaybe<Array<Vehicle_Types_Bool_Exp>>;
  agents?: InputMaybe<Agents_Bool_Exp>;
  agents_aggregate?: InputMaybe<Agents_Aggregate_Bool_Exp>;
  comment?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "vehicle_types" */
export enum Vehicle_Types_Constraint {
  /** unique or primary key constraint on columns "id" */
  VehicleTypesPkey = 'vehicle_types_pkey'
}

export enum Vehicle_Types_Enum {
  /** Bus */
  Bus = 'bus',
  /** Other */
  Other = 'other',
  /** Truck */
  Truck = 'truck',
  /** yy */
  Tt = 'tt',
  /** Van */
  Van = 'van',
  /** 2 Wheeler */
  Wheeler_2 = 'wheeler_2',
  /** 3 Wheeler */
  Wheeler_3 = 'wheeler_3',
  /** 4 Wheeler */
  Wheeler_4 = 'wheeler_4'
}

/** Boolean expression to compare columns of type "vehicle_types_enum". All fields are combined with logical 'AND'. */
export type Vehicle_Types_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Vehicle_Types_Enum>;
  _in?: InputMaybe<Array<Vehicle_Types_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<Vehicle_Types_Enum>;
  _nin?: InputMaybe<Array<Vehicle_Types_Enum>>;
};

/** input type for inserting data into table "vehicle_types" */
export type Vehicle_Types_Insert_Input = {
  agents?: InputMaybe<Agents_Arr_Rel_Insert_Input>;
  comment?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Vehicle_Types_Max_Fields = {
  __typename?: 'vehicle_types_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Vehicle_Types_Min_Fields = {
  __typename?: 'vehicle_types_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "vehicle_types" */
export type Vehicle_Types_Mutation_Response = {
  __typename?: 'vehicle_types_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Vehicle_Types>;
};

/** input type for inserting object relation for remote table "vehicle_types" */
export type Vehicle_Types_Obj_Rel_Insert_Input = {
  data: Vehicle_Types_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Vehicle_Types_On_Conflict>;
};

/** on_conflict condition type for table "vehicle_types" */
export type Vehicle_Types_On_Conflict = {
  constraint: Vehicle_Types_Constraint;
  update_columns?: Array<Vehicle_Types_Update_Column>;
  where?: InputMaybe<Vehicle_Types_Bool_Exp>;
};

/** Ordering options when selecting data from "vehicle_types". */
export type Vehicle_Types_Order_By = {
  agents_aggregate?: InputMaybe<Agents_Aggregate_Order_By>;
  comment?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: vehicle_types */
export type Vehicle_Types_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "vehicle_types" */
export enum Vehicle_Types_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Id = 'id'
}

/** input type for updating data in table "vehicle_types" */
export type Vehicle_Types_Set_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "vehicle_types" */
export type Vehicle_Types_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Vehicle_Types_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Vehicle_Types_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "vehicle_types" */
export enum Vehicle_Types_Update_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Id = 'id'
}

export type Vehicle_Types_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Vehicle_Types_Set_Input>;
  /** filter the rows which have to be updated */
  where: Vehicle_Types_Bool_Exp;
};

/** Boolean expression to compare columns of type "weight_units_enum". All fields are combined with logical 'AND'. */
export type Weight_Units_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['weight_units_enum']['input']>;
  _gt?: InputMaybe<Scalars['weight_units_enum']['input']>;
  _gte?: InputMaybe<Scalars['weight_units_enum']['input']>;
  _in?: InputMaybe<Array<Scalars['weight_units_enum']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['weight_units_enum']['input']>;
  _lte?: InputMaybe<Scalars['weight_units_enum']['input']>;
  _neq?: InputMaybe<Scalars['weight_units_enum']['input']>;
  _nin?: InputMaybe<Array<Scalars['weight_units_enum']['input']>>;
};

export type GetUserByIdentifierQueryVariables = Exact<{
  identifier: Scalars['String']['input'];
}>;


export type GetUserByIdentifierQuery = { __typename?: 'query_root', users: Array<{ __typename?: 'users', id: string, identifier: string, email: string, first_name: string, last_name: string, phone_number?: string | null, phone_number_verified?: boolean | null, email_verified?: boolean | null, user_type_id: User_Types_Enum, created_at: string, updated_at: string }> };

export type GetUserByIdQueryVariables = Exact<{
  userId: Scalars['uuid']['input'];
}>;


export type GetUserByIdQuery = { __typename?: 'query_root', users_by_pk?: { __typename?: 'users', id: string, email: string, first_name: string, last_name: string, user_type_id: User_Types_Enum, created_at: string, updated_at: string, agent?: { __typename?: 'agents', id: string } | null, client?: { __typename?: 'clients', id: string } | null, business?: { __typename?: 'businesses', id: string } | null } | null };

export type GetUserAccountQueryVariables = Exact<{
  userId: Scalars['uuid']['input'];
  currency: Scalars['currency_enum']['input'];
}>;


export type GetUserAccountQuery = { __typename?: 'query_root', accounts: Array<{ __typename?: 'accounts', id: string, available_balance: number, withheld_balance: number }> };

export type GetAccountByIdQueryVariables = Exact<{
  accountId: Scalars['uuid']['input'];
}>;


export type GetAccountByIdQuery = { __typename?: 'query_root', accounts_by_pk?: { __typename?: 'accounts', id: string, user_id: string, currency: any, available_balance: number, withheld_balance: number, is_active?: boolean | null, created_at: string, updated_at: string } | null };

export type GetUserClientQueryVariables = Exact<{
  userId: Scalars['uuid']['input'];
}>;


export type GetUserClientQuery = { __typename?: 'query_root', clients: Array<{ __typename?: 'clients', id: string, user_id: string, created_at: string, updated_at: string, client_addresses: Array<{ __typename?: 'client_addresses', address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string, is_primary?: boolean | null, address_type?: string | null, created_at?: string | null } }> }> };

export type GetUserBusinessQueryVariables = Exact<{
  userId: Scalars['uuid']['input'];
}>;


export type GetUserBusinessQuery = { __typename?: 'query_root', businesses: Array<{ __typename?: 'businesses', id: string, user_id: string, created_at: string, updated_at: string, business_addresses: Array<{ __typename?: 'business_addresses', address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string, is_primary?: boolean | null, address_type?: string | null, created_at?: string | null } }> }> };

export type GetUserAgentQueryVariables = Exact<{
  userId: Scalars['uuid']['input'];
}>;


export type GetUserAgentQuery = { __typename?: 'query_root', agents: Array<{ __typename?: 'agents', id: string, user_id: string, vehicle_type_id: Vehicle_Types_Enum, is_verified?: boolean | null, created_at: string, updated_at: string, agent_addresses: Array<{ __typename?: 'agent_addresses', address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string, is_primary?: boolean | null, address_type?: string | null, created_at?: string | null } }> }> };

export type GetClientByIdQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type GetClientByIdQuery = { __typename?: 'query_root', clients: Array<{ __typename?: 'clients', id: string, user_id: string }> };

export type GetBusinessByIdQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type GetBusinessByIdQuery = { __typename?: 'query_root', businesses: Array<{ __typename?: 'businesses', id: string, user_id: string, name: string, is_admin?: boolean | null, is_verified?: boolean | null }> };

export type GetAgentByIdQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type GetAgentByIdQuery = { __typename?: 'query_root', agents: Array<{ __typename?: 'agents', id: string, user_id: string, vehicle_type_id: Vehicle_Types_Enum, is_verified?: boolean | null }> };

export type GetAgentAddressesQueryVariables = Exact<{
  agentId: Scalars['uuid']['input'];
}>;


export type GetAgentAddressesQuery = { __typename?: 'query_root', addresses: Array<{ __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string, is_primary?: boolean | null, address_type?: string | null, created_at?: string | null, updated_at?: string | null }> };

export type GetClientAddressesQueryVariables = Exact<{
  clientId: Scalars['uuid']['input'];
}>;


export type GetClientAddressesQuery = { __typename?: 'query_root', addresses: Array<{ __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string, is_primary?: boolean | null, address_type?: string | null, created_at?: string | null, updated_at?: string | null }> };

export type GetBusinessAddressesQueryVariables = Exact<{
  businessId: Scalars['uuid']['input'];
}>;


export type GetBusinessAddressesQuery = { __typename?: 'query_root', addresses: Array<{ __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string, is_primary?: boolean | null, address_type?: string | null, created_at?: string | null, updated_at?: string | null }> };

export type GetAddressByIdQueryVariables = Exact<{
  addressId: Scalars['uuid']['input'];
}>;


export type GetAddressByIdQuery = { __typename?: 'query_root', addresses_by_pk?: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string, is_primary?: boolean | null, address_type?: string | null, created_at?: string | null, updated_at?: string | null } | null };

export type CreateUserAccountMutationVariables = Exact<{
  userId: Scalars['uuid']['input'];
  currency: Scalars['currency_enum']['input'];
}>;


export type CreateUserAccountMutation = { __typename?: 'mutation_root', insert_accounts_one?: { __typename?: 'accounts', id: string, user_id: string, currency: any, available_balance: number, withheld_balance: number, is_active?: boolean | null, created_at: string } | null };

export type UpdateAccountBalanceMutationVariables = Exact<{
  accountId: Scalars['uuid']['input'];
  availableBalance: Scalars['numeric']['input'];
  withheldBalance: Scalars['numeric']['input'];
}>;


export type UpdateAccountBalanceMutation = { __typename?: 'mutation_root', update_accounts_by_pk?: { __typename?: 'accounts', id: string, available_balance: number, withheld_balance: number, updated_at: string } | null };

export type DropOrderMutationVariables = Exact<{
  orderId: Scalars['uuid']['input'];
}>;


export type DropOrderMutation = { __typename?: 'mutation_root', update_orders_by_pk?: { __typename?: 'orders', id: string, current_status: any, assigned_agent_id?: string | null } | null };

export type UpdateOrderStatusAndPaymentStatusMutationVariables = Exact<{
  orderId: Scalars['uuid']['input'];
  newStatus: Scalars['order_status']['input'];
  paymentStatus: Scalars['String']['input'];
}>;


export type UpdateOrderStatusAndPaymentStatusMutation = { __typename?: 'mutation_root', update_orders_by_pk?: { __typename?: 'orders', id: string, order_number: string, current_status: any, payment_status?: string | null, updated_at?: string | null } | null };

export type CreateStatusHistoryMutationVariables = Exact<{
  orderId: Scalars['uuid']['input'];
  status: Scalars['order_status']['input'];
  notes: Scalars['String']['input'];
  changedByType: Scalars['String']['input'];
  changedByUserId: Scalars['uuid']['input'];
}>;


export type CreateStatusHistoryMutation = { __typename?: 'mutation_root', insert_order_status_history?: { __typename?: 'order_status_history_mutation_response', affected_rows: number } | null };

export type CreateOrderMutationVariables = Exact<{
  orderData: Orders_Insert_Input;
}>;


export type CreateOrderMutation = { __typename?: 'mutation_root', insert_orders_one?: { __typename?: 'orders', id: string, order_number: string, current_status: any, subtotal: number, base_delivery_fee: number, tax_amount: number, total_amount: number, currency: string, business_id: string, client_id: string, delivery_address_id: string, business_location_id: string, created_at?: string | null } | null };

export type UpdateOrderStatusMutationVariables = Exact<{
  orderId: Scalars['uuid']['input'];
  status: Scalars['order_status']['input'];
}>;


export type UpdateOrderStatusMutation = { __typename?: 'mutation_root', update_orders_by_pk?: { __typename?: 'orders', id: string, order_number: string, current_status: any, updated_at?: string | null } | null };

export type AssignOrderToAgentMutationVariables = Exact<{
  orderId: Scalars['uuid']['input'];
  agentId: Scalars['uuid']['input'];
}>;


export type AssignOrderToAgentMutation = { __typename?: 'mutation_root', update_orders_by_pk?: { __typename?: 'orders', id: string, order_number: string, current_status: any, assigned_agent_id?: string | null, updated_at?: string | null } | null };

export type CreateOrderItemsMutationVariables = Exact<{
  orderItems: Array<Order_Items_Insert_Input> | Order_Items_Insert_Input;
}>;


export type CreateOrderItemsMutation = { __typename?: 'mutation_root', insert_order_items?: { __typename?: 'order_items_mutation_response', affected_rows: number, returning: Array<{ __typename?: 'order_items', id: string, order_id: string, item_name: string, item_description?: string | null, unit_price: number, quantity: number, total_price: number, weight?: number | null, weight_unit?: string | null, dimensions?: string | null, special_instructions?: string | null }> } | null };

export type CreateOrderHoldMutationVariables = Exact<{
  orderHoldData: Order_Holds_Insert_Input;
}>;


export type CreateOrderHoldMutation = { __typename?: 'mutation_root', insert_order_holds_one?: { __typename?: 'order_holds', id: string, order_id: string, client_id: string, agent_id?: string | null, client_hold_amount: number, agent_hold_amount: number, delivery_fees: number, currency: any, status: any, created_at: string } | null };

export type UpdateOrderHoldMutationVariables = Exact<{
  holdId: Scalars['uuid']['input'];
  holdData: Order_Holds_Set_Input;
}>;


export type UpdateOrderHoldMutation = { __typename?: 'mutation_root', update_order_holds_by_pk?: { __typename?: 'order_holds', id: string, status: any, client_hold_amount: number, agent_hold_amount: number, delivery_fees: number, updated_at: string } | null };

export type GetBusinessOrdersQueryVariables = Exact<{
  filters?: InputMaybe<Orders_Bool_Exp>;
}>;


export type GetBusinessOrdersQuery = { __typename?: 'query_root', orders: Array<{ __typename?: 'orders', id: string, order_number: string, client_id: string, business_id: string, business_location_id: string, assigned_agent_id?: string | null, delivery_address_id: string, subtotal: number, base_delivery_fee: number, tax_amount: number, total_amount: number, currency: string, current_status: any, estimated_delivery_time?: string | null, actual_delivery_time?: string | null, special_instructions?: string | null, preferred_delivery_time?: string | null, requires_fast_delivery: boolean, per_km_delivery_fee: number, payment_method?: string | null, payment_status?: string | null, created_at?: string | null, updated_at?: string | null, delivery_time_window_id?: string | null, client: { __typename?: 'clients', id: string, user: { __typename?: 'users', id: string, first_name: string, last_name: string, email: string } }, business_location: { __typename?: 'business_locations', id: string, name: string, location_type?: any | null, address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string } }, delivery_address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string }, assigned_agent?: { __typename?: 'agents', id: string, user: { __typename?: 'users', id: string, first_name: string, last_name: string, email: string } } | null, order_items: Array<{ __typename?: 'order_items', id: string, item_name: string, item_description?: string | null, unit_price: number, quantity: number, total_price: number, weight?: number | null, weight_unit?: string | null, dimensions?: string | null, special_instructions?: string | null, item: { __typename?: 'items', sku?: string | null, currency: string, model?: string | null, color?: string | null, weight?: number | null, weight_unit?: any | null, brand?: { __typename?: 'brands', id: string, name: string } | null, item_sub_category: { __typename?: 'item_sub_categories', id: number, name: string, item_category: { __typename?: 'item_categories', id: number, name: string } }, item_images: Array<{ __typename?: 'item_images', id: string, image_url: string }> } }>, order_status_history: Array<{ __typename?: 'order_status_history', changed_by_type: string, changed_by_user_id?: string | null, created_at?: string | null, id: string, previous_status?: any | null, status: any, notes?: string | null, changed_by_user?: { __typename?: 'users', agent?: { __typename?: 'agents', user: { __typename?: 'users', email: string, first_name: string, last_name: string } } | null, business?: { __typename?: 'businesses', user: { __typename?: 'users', email: string, first_name: string, last_name: string } } | null, client?: { __typename?: 'clients', user: { __typename?: 'users', first_name: string, email: string, last_name: string } } | null } | null }>, delivery_time_windows: Array<{ __typename?: 'delivery_time_windows', id: string, slot_id: string, preferred_date: any, time_slot_start: any, time_slot_end: any, is_confirmed?: boolean | null, special_instructions?: string | null, confirmed_at?: string | null, confirmed_by?: string | null, slot: { __typename?: 'delivery_time_slots', id: string, slot_name: string, slot_type: string, start_time: any, end_time: any } }> }> };

export type GetOrderByIdQueryVariables = Exact<{
  orderId: Scalars['uuid']['input'];
}>;


export type GetOrderByIdQuery = { __typename?: 'query_root', orders_by_pk?: { __typename?: 'orders', id: string, order_number: string, client_id: string, business_id: string, business_location_id: string, assigned_agent_id?: string | null, delivery_address_id: string, subtotal: number, base_delivery_fee: number, tax_amount: number, total_amount: number, per_km_delivery_fee: number, currency: string, current_status: any, estimated_delivery_time?: string | null, actual_delivery_time?: string | null, special_instructions?: string | null, preferred_delivery_time?: string | null, payment_method?: string | null, payment_status?: string | null, verified_agent_delivery?: boolean | null, created_at?: string | null, updated_at?: string | null, client: { __typename?: 'clients', id: string, user_id: string, user: { __typename?: 'users', id: string, identifier: string, first_name: string, last_name: string, email: string, phone_number?: string | null } }, business: { __typename?: 'businesses', id: string, user_id: string, name: string, is_admin?: boolean | null, user: { __typename?: 'users', id: string, identifier: string, first_name: string, last_name: string, email: string, phone_number?: string | null } }, business_location: { __typename?: 'business_locations', id: string, name: string, location_type?: any | null, address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string, latitude?: number | null, longitude?: number | null } }, delivery_address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string, latitude?: number | null, longitude?: number | null }, assigned_agent?: { __typename?: 'agents', id: string, user_id: string, is_verified?: boolean | null, user: { __typename?: 'users', id: string, identifier: string, first_name: string, last_name: string, email: string, phone_number?: string | null } } | null, order_items: Array<{ __typename?: 'order_items', id: string, business_inventory_id: string, item_id: string, item_name: string, item_description?: string | null, unit_price: number, quantity: number, total_price: number, weight?: number | null, weight_unit?: string | null, dimensions?: string | null, special_instructions?: string | null, item: { __typename?: 'items', id: string, sku?: string | null, name: string, description: string, currency: string, model?: string | null, color?: string | null, weight?: number | null, weight_unit?: any | null, brand?: { __typename?: 'brands', id: string, name: string, description: string } | null, item_sub_category: { __typename?: 'item_sub_categories', id: number, name: string, description: string, item_category: { __typename?: 'item_categories', id: number, name: string, description: string } }, item_images: Array<{ __typename?: 'item_images', id: string, image_url: string, alt_text?: string | null, display_order?: number | null }> } }>, order_status_history: Array<{ __typename?: 'order_status_history', id: string, order_id: string, status: any, previous_status?: any | null, notes?: string | null, changed_by_type: string, changed_by_user_id?: string | null, created_at?: string | null, changed_by_user?: { __typename?: 'users', id: string, identifier: string, first_name: string, last_name: string, email: string, agent?: { __typename?: 'agents', id: string, user: { __typename?: 'users', first_name: string, last_name: string, email: string } } | null, business?: { __typename?: 'businesses', id: string, name: string, user: { __typename?: 'users', first_name: string, last_name: string, email: string } } | null, client?: { __typename?: 'clients', id: string, user: { __typename?: 'users', first_name: string, last_name: string, email: string } } | null } | null }>, order_holds: Array<{ __typename?: 'order_holds', id: string, client_id: string, agent_id?: string | null, client_hold_amount: number, agent_hold_amount: number, delivery_fees: number, currency: any, status: any, created_at: string, updated_at: string }>, delivery_time_windows: Array<{ __typename?: 'delivery_time_windows', id: string, order_id: string, slot_id: string, preferred_date: any, time_slot_start: any, time_slot_end: any, is_confirmed?: boolean | null, special_instructions?: string | null, confirmed_at?: string | null, confirmed_by?: string | null, created_at?: string | null, updated_at?: string | null, slot: { __typename?: 'delivery_time_slots', id: string, slot_name: string, slot_type: string, start_time: any, end_time: any, is_active?: boolean | null }, confirmedByUser?: { __typename?: 'users', id: string, first_name: string, last_name: string, email: string } | null }> } | null };

export type GetOrderByNumberQueryVariables = Exact<{
  orderNumber: Scalars['String']['input'];
}>;


export type GetOrderByNumberQuery = { __typename?: 'query_root', orders: Array<{ __typename?: 'orders', id: string, order_number: string, current_status: any, subtotal: number, base_delivery_fee: number, per_km_delivery_fee: number, tax_amount: number, total_amount: number, currency: string, estimated_delivery_time?: string | null, special_instructions?: string | null, business_id: string, client_id: string, delivery_address_id: string, requires_fast_delivery: boolean, client: { __typename?: 'clients', user_id: string, user: { __typename?: 'users', id: string, first_name: string, last_name: string, email: string } }, business_location: { __typename?: 'business_locations', id: string, address_id: string, business: { __typename?: 'businesses', id: string, name: string, is_verified?: boolean | null, user: { __typename?: 'users', id: string, email: string } }, address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string } }, delivery_address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string }, order_items: Array<{ __typename?: 'order_items', id: string, item_name: string, item_description?: string | null, unit_price: number, quantity: number, total_price: number, weight?: number | null, weight_unit?: string | null, dimensions?: string | null, special_instructions?: string | null, item: { __typename?: 'items', id: string, sku?: string | null, name: string, description: string, currency: string, model?: string | null, color?: string | null, weight?: number | null, weight_unit?: any | null, brand?: { __typename?: 'brands', id: string, name: string } | null, item_sub_category: { __typename?: 'item_sub_categories', id: number, name: string, item_category: { __typename?: 'item_categories', id: number, name: string } }, item_images: Array<{ __typename?: 'item_images', id: string, image_url: string }> } }>, delivery_time_windows: Array<{ __typename?: 'delivery_time_windows', id: string, order_id: string, slot_id: string, preferred_date: any, time_slot_start: any, time_slot_end: any, is_confirmed?: boolean | null, special_instructions?: string | null, confirmed_at?: string | null, confirmed_by?: string | null, created_at?: string | null, updated_at?: string | null, slot: { __typename?: 'delivery_time_slots', id: string, slot_name: string, slot_type: string, start_time: any, end_time: any, is_active?: boolean | null }, confirmedByUser?: { __typename?: 'users', id: string, first_name: string, last_name: string, email: string } | null }> }> };

export type GetOrderQueryVariables = Exact<{
  orderId: Scalars['uuid']['input'];
}>;


export type GetOrderQuery = { __typename?: 'query_root', orders_by_pk?: { __typename?: 'orders', id: string, order_number: string, current_status: any, total_amount: number, currency: string, business_id: string, client_id: string, delivery_address_id: string, assigned_agent_id?: string | null, client: { __typename?: 'clients', user_id: string }, business: { __typename?: 'businesses', user_id: string }, business_location: { __typename?: 'business_locations', address_id: string }, assigned_agent?: { __typename?: 'agents', user_id: string } | null } | null };

export type GetOrderWithItemsQueryVariables = Exact<{
  orderId: Scalars['uuid']['input'];
}>;


export type GetOrderWithItemsQuery = { __typename?: 'query_root', orders_by_pk?: { __typename?: 'orders', id: string, order_number: string, current_status: any, subtotal: number, base_delivery_fee: number, tax_amount: number, total_amount: number, currency: string, business_id: string, client_id: string, delivery_address_id: string, client: { __typename?: 'clients', user_id: string, user: { __typename?: 'users', id: string, first_name: string, last_name: string, email: string } }, business_location: { __typename?: 'business_locations', id: string, address_id: string, business: { __typename?: 'businesses', id: string, name: string, user: { __typename?: 'users', id: string, email: string } }, address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string } }, delivery_address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string }, order_items: Array<{ __typename?: 'order_items', id: string, item_name: string, item_description?: string | null, unit_price: number, quantity: number, total_price: number, weight?: number | null, weight_unit?: string | null, dimensions?: string | null, special_instructions?: string | null, item: { __typename?: 'items', id: string, sku?: string | null, name: string, description: string, currency: string, model?: string | null, color?: string | null, weight?: number | null, weight_unit?: any | null, brand?: { __typename?: 'brands', id: string, name: string } | null, item_sub_category: { __typename?: 'item_sub_categories', id: number, name: string, item_category: { __typename?: 'item_categories', id: number, name: string } }, item_images: Array<{ __typename?: 'item_images', id: string, image_url: string }> } }> } | null };

export type OpenOrdersQueryVariables = Exact<{ [key: string]: never; }>;


export type OpenOrdersQuery = { __typename?: 'query_root', orders: Array<{ __typename?: 'orders', id: string, order_number: string, subtotal: number, base_delivery_fee: number, tax_amount: number, total_amount: number, currency: string, estimated_delivery_time?: string | null, special_instructions?: string | null, requires_fast_delivery: boolean, per_km_delivery_fee: number, created_at?: string | null, business: { __typename?: 'businesses', name: string }, client: { __typename?: 'clients', user: { __typename?: 'users', id: string, first_name: string, last_name: string, phone_number?: string | null, email: string } }, business_location: { __typename?: 'business_locations', id: string, name: string, address: { __typename?: 'addresses', address_line_1: string, city: string, state: string, country: string, postal_code: string } }, delivery_address: { __typename?: 'addresses', id: string, address_line_1: string, address_line_2?: string | null, city: string, state: string, postal_code: string, country: string }, order_items: Array<{ __typename?: 'order_items', id: string, item_name: string, item_description?: string | null, unit_price: number, quantity: number, total_price: number, weight?: number | null, weight_unit?: string | null, dimensions?: string | null, special_instructions?: string | null, item: { __typename?: 'items', sku?: string | null, currency: string, model?: string | null, color?: string | null, weight?: number | null, weight_unit?: any | null, brand?: { __typename?: 'brands', id: string, name: string } | null, item_sub_category: { __typename?: 'item_sub_categories', id: number, name: string, item_category: { __typename?: 'item_categories', id: number, name: string } }, item_images: Array<{ __typename?: 'item_images', id: string, image_url: string }> } }> }> };

export type GetUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUsersQuery = { __typename?: 'query_root', users: Array<{ __typename?: 'users', id: string, first_name: string, last_name: string, email: string, user_type_id: User_Types_Enum, created_at: string, updated_at: string }> };

export type GetOrdersQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetOrdersQuery = { __typename?: 'query_root', orders: Array<{ __typename?: 'orders', id: string, order_number: string, total_amount: number, created_at?: string | null, client: { __typename?: 'clients', id: string } }> };
