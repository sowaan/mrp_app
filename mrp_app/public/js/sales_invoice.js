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
    async item_tax_template(frm, cdt, cdn) {
        await update_custom_pricing(frm, cdt, cdn);
    },
});

async function update_custom_pricing(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    // Step 1: Fetch item tax rate from Item Tax Template (if any)
    let taxRate = 0;
    if (row.item_tax_template) {
        try {
            const { message } = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Item Tax Template',
                    name: row.item_tax_template,
                }
            });
            if (message && message.taxes?.length) {
                taxRate = message.taxes[0].tax_rate || 0;
            }
        } catch (error) {
            console.error("Error fetching Item Tax Template:", error);
        }
    }

    const taxRatePer = taxRate / 100;

    // Step 2: Compute unit price and tax
    const price_list_rate = row.price_list_rate || 0;
    const qty = row.qty || 0;

    row.custom_unit_price = price_list_rate / (1 + taxRatePer);
    const item_tax_amount = row.custom_unit_price * taxRatePer;
    row.custom_sales_tax_amount = qty * item_tax_amount;

    // Step 3: Fetch trade pricing from customer
    let trade_price = 0;
    let discount_on_tp = 0;

    try {
        const { message } = await frappe.call({
            method: 'frappe.client.get_value',
            args: {
                doctype: 'Customer',
                filters: { name: frm.doc.customer },
                fieldname: ['custom_trade_price', 'custom_discount_on_tp']
            }
        });
        if (message) {
            trade_price = message.custom_trade_price || 0;
            discount_on_tp = message.custom_discount_on_tp || 0;
        }
    } catch (error) {
        console.error("Error fetching customer pricing:", error);
    }

    // Step 4: Apply discounts
    row.custom_trade_price = row.custom_unit_price * (1 - trade_price / 100);
    row.custom_discount_on_tp = row.custom_trade_price * (1 - discount_on_tp / 100);
    row.custom_item_amount = row.custom_discount_on_tp * qty;

    // Step 5: Final rate and discount amount
    row.discount_amount = price_list_rate - (row.custom_discount_on_tp + item_tax_amount);
    row.rate = row.custom_discount_on_tp + item_tax_amount;

    // Step 6: Refresh UI
    frm.refresh_field('items');
    let total_tax_amount = 0;
    for (let i = 0; i < frm.doc.items.length; i++) {
        const ele = frm.doc.items[i];
        total_tax_amount += ele.custom_sales_tax_amount;
    }
    let taxes = frm.doc.taxes;
    if (taxes.length > 0) {
        for (let i = 0; i < taxes.length; i++) {
            const ele = taxes[i];
            ele.charge_type = "Actual";
            ele.rate = 0;
            ele.tax_amount = total_tax_amount;
        }
    }

}
