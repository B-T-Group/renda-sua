export const GET_INVENTORY_FOR_EXPORT = `
  query GetInventoryForExport($id: uuid!) {
    business_inventory_by_pk(id: $id) {
      id
      is_active
      business_location_id
      item_id
      business_location {
        id
        name
        business_id
        business { id name user_id }
      }
      item {
        id
        name
        description
        export_available
        moderation_status
        is_active
      }
    }
  }
`;

export const GET_CLIENT_REFERRAL = `
  query GetClientReferral($userId: uuid!) {
    clients(where: { user_id: { _eq: $userId } }, limit: 1) {
      id
      referred_by_user_id
    }
  }
`;

export const NEXT_DOC_NUMBER = `
  query NextExportDocNumber($prefix: String!, $country: String) {
    next_export_doc_number(args: { p_prefix: $prefix, p_country: $country })
  }
`;

export const INSERT_EXPORT_ORDER = `
  mutation InsertExportOrder($object: export_orders_insert_input!) {
    insert_export_orders_one(object: $object) {
      id
      status
      bc_number
      bc_version
      created_at
      client_user_id
      agent_user_id
      business_id
      country_code
    }
  }
`;

export const GET_EXPORT_ORDER = `
  query GetExportOrder($id: uuid!) {
    export_orders_by_pk(id: $id) {
      id
      status
      client_user_id
      client_id
      agent_user_id
      business_id
      business_location_id
      country_code
      currency
      bc_number
      bc_version
      product_interest_request_id
      balance_option
      deposit_rate
      credit_rate_full
      credit_rate_30
      credit_rate_60
      manufacturer_cost_total
      client_subtotal
      fees_total
      tax_total
      grand_total
      deposit_amount
      balance_amount
      credit_limit
      has_open_dispute
      bc_expires_at
      proforma_expires_at
      deposit_due_at
      client_note
      admin_notes
      closed_at
      created_at
      updated_at
      lines(order_by: { sort_order: asc }) {
        id
        item_id
        business_inventory_id
        product_name
        characteristics
        quantity
        unit
        particularities
        unit_price
        manufacturer_unit_cost
        line_total
        sort_order
      }
      documents(order_by: { issued_at: desc }) {
        id
        doc_type
        document_number
        version_number
        upload_id
        sha256
        issued_at
        locked
      }
      invoices(order_by: { created_at: desc }) {
        id
        kind
        document_id
        version_number
        subtotal
        fees_total
        tax_total
        grand_total
        deposit_rate
        deposit_amount
        balance_amount
        credit_applied
        validity_days
        valid_until
        client_approved_at
        locked
      }
      payments(order_by: { created_at: desc }) {
        id
        amount
        currency
        method
        reference
        value_date
        allocation
        receipt_document_id
        voided_at
        created_at
      }
      shipments(order_by: { created_at: desc }) {
        id
        carrier
        tracking_number
        bill_of_lading
        certificate_of_origin
        dispatched_at
        delivered_at
        notes
      }
      client_user {
        id
        first_name
        last_name
        email
        phone_number
      }
      business {
        id
        name
        user_id
      }
    }
  }
`;

export const LIST_EXPORT_ORDERS = `
  query ListExportOrders(
    $where: export_orders_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    export_orders_aggregate(where: $where) {
      aggregate { count }
    }
    export_orders(
      where: $where
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      status
      bc_number
      bc_version
      country_code
      currency
      grand_total
      deposit_amount
      balance_amount
      balance_option
      client_user_id
      agent_user_id
      business_id
      created_at
      updated_at
      client_user { id first_name last_name email }
      business { id name }
    }
  }
`;

export const UPDATE_EXPORT_ORDER = `
  mutation UpdateExportOrder($id: uuid!, $set: export_orders_set_input!) {
    update_export_orders_by_pk(pk_columns: { id: $id }, _set: $set) {
      id
      status
      updated_at
    }
  }
`;

export const INSERT_AUDIT = `
  mutation InsertExportAudit($object: export_audit_log_insert_input!) {
    insert_export_audit_log_one(object: $object) { id }
  }
`;

export const INSERT_REVIEW = `
  mutation InsertExportReview($object: export_reviews_insert_input!) {
    insert_export_reviews_one(object: $object) { id }
  }
`;

export const INSERT_MFR_QUOTE = `
  mutation InsertMfrQuote($object: export_manufacturer_quotes_insert_input!) {
    insert_export_manufacturer_quotes_one(object: $object) { id }
  }
`;

export const DELETE_FEES = `
  mutation DeleteExportFees($orderId: uuid!) {
    delete_export_additional_fees(where: { export_order_id: { _eq: $orderId } }) {
      affected_rows
    }
  }
`;

export const INSERT_FEES = `
  mutation InsertExportFees($objects: [export_additional_fees_insert_input!]!) {
    insert_export_additional_fees(objects: $objects) { affected_rows }
  }
`;

export const UPDATE_LINE = `
  mutation UpdateExportLine($id: uuid!, $set: export_order_lines_set_input!) {
    update_export_order_lines_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

export const INSERT_INVOICE = `
  mutation InsertExportInvoice($object: export_invoices_insert_input!) {
    insert_export_invoices_one(object: $object) {
      id
      kind
      version_number
      grand_total
      deposit_amount
    }
  }
`;

export const UPDATE_INVOICE = `
  mutation UpdateExportInvoice($id: uuid!, $set: export_invoices_set_input!) {
    update_export_invoices_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

export const INSERT_DOCUMENT = `
  mutation InsertExportDocument($object: export_documents_insert_input!) {
    insert_export_documents_one(object: $object) {
      id
      document_number
      doc_type
      version_number
    }
  }
`;

export const INSERT_PAYMENT = `
  mutation InsertExportPayment($object: export_payments_insert_input!) {
    insert_export_payments_one(object: $object) {
      id
      amount
      allocation
    }
  }
`;

export const UPDATE_PAYMENT = `
  mutation UpdateExportPayment($id: uuid!, $set: export_payments_set_input!) {
    update_export_payments_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

export const ACTIVE_BANK_ACCOUNT = `
  query ActiveExportBankAccount {
    export_bank_accounts(
      where: { is_active: { _eq: true } }
      order_by: { valid_from: desc }
      limit: 1
    ) {
      id
      institution
      transit
      account_number
      swift
      beneficiary
      currency
    }
  }
`;

export const INSERT_BANK_ACCOUNT = `
  mutation InsertExportBankAccount($object: export_bank_accounts_insert_input!) {
    insert_export_bank_accounts_one(object: $object) { id }
  }
`;

export const DEACTIVATE_BANK_ACCOUNTS = `
  mutation DeactivateExportBankAccounts($validTo: timestamptz!) {
    update_export_bank_accounts(
      where: { is_active: { _eq: true } }
      _set: { is_active: false, valid_to: $validTo }
    ) { affected_rows }
  }
`;

export const INSERT_SUPPLIER_PAYMENT = `
  mutation InsertSupplierPayment($object: export_supplier_payments_insert_input!) {
    insert_export_supplier_payments_one(object: $object) { id }
  }
`;

export const COUNT_SUPPLIER_BALANCE = `
  query CountSupplierBalance($orderId: uuid!) {
    export_supplier_payments_aggregate(
      where: {
        export_order_id: { _eq: $orderId }
        kind: { _eq: "balance" }
      }
    ) { aggregate { count } }
  }
`;

export const INSERT_SHIPMENT = `
  mutation InsertShipment($object: export_shipments_insert_input!) {
    insert_export_shipments_one(object: $object) { id }
  }
`;

export const UPSERT_FINANCING = `
  mutation UpsertFinancing($object: export_financing_insert_input!) {
    insert_export_financing_one(
      object: $object
      on_conflict: {
        constraint: export_financing_export_order_id_key
        update_columns: [option_days, approved, approved_by, approved_at, due_date, principal, status, updated_at]
      }
    ) { id }
  }
`;

export const INSERT_REVENUE = `
  mutation UpsertRevenue($object: export_order_revenue_insert_input!) {
    insert_export_order_revenue_one(
      object: $object
      on_conflict: {
        constraint: export_order_revenue_export_order_id_key
        update_columns: [manufacturer_cost, client_price, fees_passthrough, rendasua_revenue, updated_at]
      }
    ) { id }
  }
`;

export const INSERT_COMMISSION = `
  mutation InsertCommission($object: export_commissions_insert_input!) {
    insert_export_commissions_one(object: $object) { id amount status }
  }
`;

export const INSERT_CREDIT_NOTE = `
  mutation InsertCreditNote($object: export_credit_notes_insert_input!) {
    insert_export_credit_notes_one(object: $object) { id document_number amount }
  }
`;

export const INSERT_CREDIT_LEDGER = `
  mutation InsertCreditLedger($object: export_credit_ledger_insert_input!) {
    insert_export_credit_ledger_one(object: $object) { id }
  }
`;

export const INSERT_VERSION = `
  mutation InsertOrderVersion($object: export_order_versions_insert_input!) {
    insert_export_order_versions_one(object: $object) { id }
  }
`;

export const LIST_EXPIRING = `
  query ListExpiringExportOrders($now: timestamptz!, $statuses: [String!]!) {
    export_orders(
      where: {
        status: { _in: $statuses }
        _or: [
          { bc_expires_at: { _lte: $now } }
          { proforma_expires_at: { _lte: $now } }
          { deposit_due_at: { _lte: $now } }
        ]
      }
      limit: 100
    ) {
      id
      status
      bc_expires_at
      proforma_expires_at
      deposit_due_at
      client_user_id
    }
  }
`;

export const LIST_FINANCING_DUE = `
  query ListFinancingDue($from: date!, $to: date!) {
    export_financing(
      where: {
        status: { _in: ["active", "approved", "overdue"] }
        due_date: { _gte: $from, _lte: $to }
      }
      limit: 200
    ) {
      id
      export_order_id
      due_date
      principal
      status
      option_days
      export_order {
        id
        client_user_id
        agent_user_id
        bc_number
      }
    }
  }
`;

export const GET_AGENT_COMMISSION_RATE = `
  query GetAgentCommissionRate($userId: uuid!) {
    agents(where: { user_id: { _eq: $userId } }, limit: 1) {
      id
      user_id
    }
    agent_contracts(
      where: { agent: { user_id: { _eq: $userId } }, status: { _eq: "active" } }
      order_by: { created_at: desc }
      limit: 1
    ) {
      id
      commission_rate
    }
  }
`;

export const DASHBOARD_BY_STATUS = `
  query ExportDashboardByStatus {
    export_orders(limit: 5000) {
      id
      status
      country_code
      grand_total
      deposit_amount
      balance_amount
      balance_option
      currency
    }
  }
`;

export const CONFIG_EXPORT_ENABLED = `
  query ExportOrdersEnabled {
    application_configurations(
      where: {
        config_key: { _eq: "export_orders_enabled" }
        status: { _eq: "active" }
      }
      order_by: [{ country_code: asc_nulls_last }]
      limit: 5
    ) {
      boolean_value
      country_code
    }
  }
`;
