import { config } from '../config.js';

/** Chegirma bilan birlik narxi (so'm, butun son) */
export function unitPrice(price, discount = 0) {
  const d = Math.min(Math.max(Number(discount) || 0, 0), 90);
  return Math.round((Number(price) * (100 - d)) / 100);
}

/**
 * Savat summasini SERVERDA hisoblash. Mijozdan kelgan narxga hech qachon ishonilmaydi.
 * @param {{product_id:number,name:string,price:number,discount:number,quantity:number}[]} rows
 */
export function calcTotals(rows, opts = {}) {
  const fee = opts.deliveryFee ?? config.deliveryFee;
  const freeFrom = opts.freeDeliveryFrom ?? config.freeDeliveryFrom;
  const items = rows.map((r) => {
    const price = unitPrice(r.price, r.discount);
    return {
      product_id: r.product_id,
      name: r.name,
      quantity: r.quantity,
      price,
      line_total: price * r.quantity,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const delivery_fee = subtotal === 0 || subtotal >= freeFrom ? 0 : fee;
  return { items, subtotal, delivery_fee, total: subtotal + delivery_fee };
}
