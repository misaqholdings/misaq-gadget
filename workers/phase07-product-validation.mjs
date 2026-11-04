// Phase 07 product validation helpers. No production integration.
export const PRODUCT_STATUSES=new Set(["active","inactive"]);
export function validateProduct(input){
 if(!input||typeof input!=="object")throw Error("invalid_product");
 const code=String(input.product_code||"").trim().toUpperCase();
 const name=String(input.product_name||"").trim();
 const price=Number(input.sale_price);
 const status=input.status??"inactive";
 if(!/^[A-Z0-9_-]{3,64}$/.test(code))throw Error("invalid_product_code");
 if(name.length<3||name.length>160)throw Error("invalid_product_name");
 if(!Number.isFinite(price)||price<0||price>10000000)throw Error("invalid_sale_price");
 if(!PRODUCT_STATUSES.has(status))throw Error("invalid_product_status");
 return {product_code:code,product_name:name,sale_price:price,status,currency:"BDT"};
}
export function validateVariant(input){
 if(!input||typeof input!=="object")throw Error("invalid_variant");
 const sku=String(input.sku||"").trim().toUpperCase();
 const name=String(input.variant_name||"").trim();
 const stock=input.stock_quantity??0;
 const price=input.price_override??null;
 const status=input.status??"inactive";
 if(!/^[A-Z0-9_-]{3,80}$/.test(sku))throw Error("invalid_sku");
 if(name.length<1||name.length>120)throw Error("invalid_variant_name");
 if(!Number.isSafeInteger(stock)||stock<0)throw Error("invalid_stock");
 if(price!==null&&(!Number.isFinite(price)||price<0||price>10000000))throw Error("invalid_variant_price");
 if(!PRODUCT_STATUSES.has(status))throw Error("invalid_variant_status");
 const attrs=input.attributes??{};
 if(!attrs||typeof attrs!=="object"||Array.isArray(attrs)||JSON.stringify(attrs).length>2000)throw Error("invalid_attributes");
 return {sku,variant_name:name,stock_quantity:stock,price_override:price,status,attributes_json:JSON.stringify(attrs)};
}
