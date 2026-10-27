// @ts-check

const EGIFT_PRODUCT_ID = "gid://shopify/Product/14858264871282";

const GWP_CONDITIONS = [
  {
    thresholdAmount: 150,
    giftProductIds: ["gid://shopify/Product/14824060748146"],
  },
  {
    thresholdAmount: 300,
    giftProductIds: [
      "gid://shopify/Product/14777830834546",
      "gid://shopify/Product/15180028641650",
      "gid://shopify/Product/15245871448434",
    ],
  },
];

const ERROR_MESSAGE =
  "Please select your gift option to proceed.";

function getLineActualAmount(line) {
  const subtotal = Number(line?.cost?.subtotalAmount?.amount || 0);
  const discounted = (line?.discountAllocations || []).reduce(
    (sum, d) => sum + Number(d?.discountedAmount?.amount || 0),
    0
  );
  return subtotal - discounted;
}

export function cartValidationsGenerateRun(input) {
  const step = input.buyerJourney?.step;
  const VALIDATE_STEPS = ["CHECKOUT_INTERACTION", "CHECKOUT_COMPLETION"];

  if (!VALIDATE_STEPS.includes(step)) {
    return { operations: [{ validationAdd: { errors: [] } }] };
  }

  // // 테스트 고객만 validation 동작
  // const tagResults = input?.cart?.buyerIdentity?.customer?.hasTags ?? [];
  // const isTestCustomer = tagResults.some(
  //   (tag) => tag?.tag === "gwp-test" && tag?.hasTag === true
  // );

  // if (!isTestCustomer) {
  //   return { operations: [{ validationAdd: { errors: [] } }] };
  // }

  // ── 메타오브젝트에서 conditionTypes, 캠페인 기간 읽기 ────────

  const metaobject = input?.shop?.metaobject;

  if (!metaobject) {
    return { operations: [{ validationAdd: { errors: [] } }] };
  }

  const conditionTypes = parseConditionTypes(metaobject?.condition_type?.value);

  if (!conditionTypes.includes("amount")) {
    return { operations: [{ validationAdd: { errors: [] } }] };
  }

  const isCampaignPeriod = input?.shop?.localTime?.isCampaignPeriod;

  if (!isCampaignPeriod) {
    return { operations: [{ validationAdd: { errors: [] } }] };
  }

  // ── 카트 데이터 ──────────────────────────────────────────


  const currencyCode = "USD";
  const cartLines = input?.cart?.lines ?? [];
  const cartTotalAmount = Number(input?.cart?.cost?.totalAmount?.amount || 0);

  const eGiftAmount = cartLines.reduce((sum, line) => {
    if (line?.merchandise?.__typename !== "ProductVariant") return sum;
    if (line?.merchandise?.product?.id !== EGIFT_PRODUCT_ID) return sum;
    return sum + getLineActualAmount(line);
  }, 0);

  const totalAmount = cartTotalAmount - eGiftAmount;

  // ── currency 필터 후 threshold 내림차순 정렬 ──────────────

  const sortedConditions = [...GWP_CONDITIONS]
    // .filter((c) => c.currencyCode === currencyCode)
    .sort((a, b) => (b.thresholdAmount || 0) - (a.thresholdAmount || 0));

  // ── 해당하는 tier의 gift가 카트에 있는지 확인 ────────────

  const eligibleCondition = sortedConditions.find(
    (condition) => totalAmount >= condition.thresholdAmount
  );

  if (!eligibleCondition) {
    return { operations: [{ validationAdd: { errors: [] } }] };
  }

  // 목록 중 정확히 1개 (quantity 합산, 2개 이상도 차단)
  const giftQuantity = cartLines.reduce((sum, line) => {
    if (line?.merchandise?.__typename !== "ProductVariant") return sum;
    if (!eligibleCondition.giftProductIds.includes(line?.merchandise?.product?.id)) return sum;
    return sum + Number(line?.quantity || 0);
  }, 0);

  const hasOneGift = giftQuantity === 1;

  const errors = hasOneGift
    ? []
    : [{ message: ERROR_MESSAGE, target: "$.cart" }];

  return { operations: [{ validationAdd: { errors } }] };
}

// ── 유틸 함수 ───────────────────────────────────────────────

function parseConditionTypes(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [value];
  }
}