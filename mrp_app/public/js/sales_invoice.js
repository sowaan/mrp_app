frappe.ui.form.on('Sales Invoice', {
    refresh(frm) {
        // your code here
    }
})

frappe.ui.form.on('Sales Invoice Item', {
    async item_code(frm, cdt, cdn) {
        await update_custom_pricing(frm, cdt, cdn);
    },
    async qty(frm, cdt, cdn) {
        await update_custom_pricing(frm, cdt, cdn);
    },
    async price_list_rate(frm, cdt, cdn) {
        await update_custom_pricing(frm, cdt, cdn);
    },
    async custom_unit_price(frm, cdt, cdn) {
        await update_custom_pricing(frm, cdt, cdn);
    },
});

async function update_custom_pricing(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const taxRate = frm.doc.taxes.length > 0 ? frm.doc.taxes[0].rate : 0;
    const taxRatePer = taxRate / 100;

    // Calculate base unit price excluding tax
    row.custom_unit_price = row.price_list_rate / (1 + taxRatePer);

    // Calculate tax per item
    const item_tax_amount = row.custom_unit_price * taxRatePer;
    row.custom_sales_tax_amount = row.qty * item_tax_amount;

    // Get trade price and discount from customer
    let trade_price = 0;
    let discount_on_tp = 0;

    const response = await frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Customer',
            filters: { name: frm.doc.customer },
            fieldname: ['custom_trade_price', 'custom_discount_on_tp']
        }
    });

    if (response.message) {
        trade_price = response.message.custom_trade_price || 0;
        discount_on_tp = response.message.custom_discount_on_tp || 0;
    }

    // Apply trade price discount
    row.custom_trade_price = row.custom_unit_price - (row.custom_unit_price * (trade_price / 100));

    // Apply further discount on trade price
    row.custom_discount_on_tp = row.custom_trade_price - (row.custom_trade_price * (discount_on_tp / 100));

    // Final item amount and rate
    row.custom_item_amount = row.custom_discount_on_tp * row.qty;
    row.discount_amount = row.price_list_rate - (row.custom_discount_on_tp + item_tax_amount);
    row.rate = row.custom_discount_on_tp + item_tax_amount;

    // Refresh the row to reflect updates
    frm.refresh_field('items');
}
