import { describe, test, expect } from "vitest";
import { cartValidationsGenerateRun } from "../src/cart_validations_generate_run";

const GIFT_A = "gid://shopify/Product/14777830834546";
const GIFT_B = "gid://shopify/Product/15180028641650";
const GIFT_150 = "gid://shopify/Product/14824060748146";
const NORMAL = "gid://shopify/Product/1";

function line(productId, amount, quantity = 1) {
  return {
    quantity,
    cost: { subtotalAmount: { amount: String(amount) }, totalAmount: { amount: String(amount) } },
    discountAllocations: [],
    merchandise: { __typename: "ProductVariant", product: { id: productId } },
  };
}

function run(lines) {
  const totalAmount = lines.reduce((sum, l) => sum + Number(l.cost.totalAmount.amount), 0);
  const result = cartValidationsGenerateRun({
    buyerJourney: { step: "CHECKOUT_COMPLETION" },
    shop: {
      localTime: { isCampaignPeriod: true },
      metaobject: { condition_type: { value: '["amount"]' } },
    },
    cart: { cost: { totalAmount: { amount: String(totalAmount) } }, lines },
  });
  return result.operations[0].validationAdd.errors.length;
}

describe("gift count validation", () => {
  test("blocks when no gift", () => {
    expect(run([line(NORMAL, 300)])).toBe(1);
  });

  test("allows exactly one gift from the list", () => {
    expect(run([line(NORMAL, 300), line(GIFT_A, 0)])).toBe(0);
    expect(run([line(NORMAL, 300), line(GIFT_B, 0)])).toBe(0);
  });

  test("blocks same gift with quantity 2", () => {
    expect(run([line(NORMAL, 300), line(GIFT_A, 0, 2)])).toBe(1);
  });

  test("blocks two different gifts", () => {
    expect(run([line(NORMAL, 300), line(GIFT_A, 0), line(GIFT_B, 0)])).toBe(1);
  });

  test("blocks lower-tier gift on higher tier", () => {
    expect(run([line(NORMAL, 300), line(GIFT_150, 0)])).toBe(1);
  });

  test("single-gift tier still works", () => {
    expect(run([line(NORMAL, 150), line(GIFT_150, 0)])).toBe(0);
    expect(run([line(NORMAL, 150)])).toBe(1);
  });

  test("allows below threshold", () => {
    expect(run([line(NORMAL, 100)])).toBe(0);
  });
});
