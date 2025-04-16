import frappe

@frappe.whitelist()
def get_trade_discount(customer):
    custom_trade_price, custom_discount_on_tp = frappe.db.get_value("Customer", customer, ["custom_trade_price", "custom_discount_on_tp"])
    
    return {"custom_trade_price": custom_trade_price, "custom_discount_on_tp": custom_discount_on_tp}