import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  useCartLines,
  useTotalAmount,
  useInstructions,
  useBuyerJourneyIntercept,
} from "@shopify/ui-extensions/checkout/preact";

export default function extension() {
  render(<Extension />, document.body);
}

const GWP_HANDLE = "app--417617707009--gwp-gzaxwiiz";
const GWP_TYPE = "app--417617707009--gwp";
const EGIFT_PRODUCT_ID = "gid://shopify/Product/14858264871282";

function Extension() {
  const cartLines = useCartLines();
  const total = useTotalAmount();
  const instructions = useInstructions();
  const isRemovingRef = useRef(false);
  const isNormalizingGiftQtyRef = useRef(false);
  const isAddingRef = useRef(false);

  useEffect(() => {
    // console.log("[GWP DEBUG] line.cost raw", cartLines.map(l => l.cost));
    // console.log("[GWP DEBUG] line 전체 구조 (첫번째 라인)", cartLines[0]);
    // const sumOfLineTotals = cartLines.reduce(
    //   (sum, l) => sum + Number(l?.cost?.totalAmount?.amount || 0),
    //   0
    // );
    // console.log("[GWP DEBUG] 라인 totalAmount 합 vs 카트 total", {
    //   sumOfLineTotals,
    //   cartTotal: total?.amount, // useTotalAmount()
    // });
    console.log("[GWP DEBUG] cartLines", cartLines);
    
    
  }, [cartLines, total]);
 

  const [gwp, setGwp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  // GWP condition type: collection 비활성화로 인해 주석 처리
  // const [productsWithCollections, setProductsWithCollections] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [isAdding, setIsAdding] = useState(false);

  // const [debugInfo, setDebugInfo] = useState("");

  const totalAmount = useMemo(() => {
    const egiftAmount = cartLines.reduce((sum, line) => {
      if (line?.merchandise?.product?.id === EGIFT_PRODUCT_ID) {
        return sum + Number(line?.cost?.totalAmount?.amount || 0); // 원복
      }
      return sum;
    }, 0);

    return Number(total?.amount || 0) - egiftAmount;
  }, [cartLines, total])
  const currencyCode = "USD";

  // GWP condition type: product/collection 비활성화로 인해 주석 처리
  // const productIds = useMemo(() => {
  //   return [
  //     ...new Set(
  //       cartLines
  //         .map((line) => line?.merchandise?.product?.id)
  //         .filter(Boolean)
  //     ),
  //   ];
  // }, [cartLines]);

  useEffect(() => {
    fetchGwp();
  }, []);

  // GWP condition type: collection 비활성화로 인해 주석 처리
  // useEffect(() => {
  //   if (!productIds.length) {
  //     setProductsWithCollections([]);
  //     return;
  //   }
  //   fetchProductCollections(productIds);
  // }, [productIds.join(",")]);

  const conditions = useMemo(() => {
    return gwp?.conditions || [];
  }, [gwp]);

  const conditionTypes = useMemo(() => {
    return gwp?.conditionTypes || [];
  }, [gwp]);

  // 모든 조건 사은품 목록의 합집합 (사은품 라인 식별용)
  const giftProductIds = useMemo(() => {
    return [
      ...new Set(
        conditions.flatMap((condition) =>
          condition.giftProducts.map((product) => product.id)
        )
      ),
    ];
  }, [conditions]);

  // ── 조건 평가 함수 ──────────────────────────────────────────

  function isAmountConditionMatched(condition) {
    if (!conditionTypes.includes("amount")) return true;

    if (condition.currencyCode !== currencyCode) return false;

    // GWP condition type: collection 비활성화로 인해 주석 처리
    // if (condition.collectionOnly) return true;

    return totalAmount >= Number(condition.thresholdAmount || 0);
  }

  // GWP condition type: product/collection 비활성화로 인해 주석 처리
  // function getBundleGroupId(line) {
  //   const attrs = line.attributes || [];

  //   // 1차: _bundle_group_id 필드 우선 사용 (있으면 그대로 신뢰)
  //   // const directAttr = attrs.find((a) => a.key === "_bundle_group_id");
  //   // if (directAttr?.value) return directAttr.value;

  //   // 2차: 없으면 'Part of' 속성에서 (group xxxxx) 패턴 추출
  //   const partOfAttr = attrs.find((a) => a.key === "Part of");
  //   if (partOfAttr?.value) {
  //     const match = partOfAttr.value.match(/\(group\s+([^\)]+)\)/);
  //     if (match) return match[1].trim();
  //   }

  //   return null; // 세트 아님 (단품)
  // }

  // function getEffectiveQuantity(lines) {
  //   const seenGroupIds = new Set();
  //   let total = 0;

  //   for (const line of lines) {
  //     const groupId = getBundleGroupId(line); // 위 수정된 함수 사용
  //     if (groupId) {
  //       if (!seenGroupIds.has(groupId)) {
  //         seenGroupIds.add(groupId);
  //         total += 1;
  //       }
  //     } else {
  //       total += Number(line.quantity || 0);
  //     }
  //   }

  //   return total;
  // }

  // ── 번들(세트) 상위 상품 타이틀 추출 ──────────────────────
  /* GWP condition type: product/collection 비활성화로 인해 주석 처리
  function getBundleTitle(line) {
    const attrs = line.attributes || [];
    const partOfAttr = attrs.find((a) => a.key === "Part of");
    if (!partOfAttr?.value) return null;

    const match = partOfAttr.value.match(/Bundle\s+(.+?)\s*\(group\s+[^)]+\)\s*$/);
    if (!match) return null;

    // \u201C = " (왼쪽 스마트 따옴표), \u201D = " (오른쪽 스마트 따옴표)
    // 일반 따옴표(", '), 전각 따옴표 등도 함께 커버
    return match[1]
      .replace(/^[\s\u201C\u201D\u2018\u2019"'ff]+/, "")
      .replace(/[\s\u201C\u201D\u2018\u2019"'ff]+$/, "")
      .trim();
  }
  */

  /* GWP condition type: product/collection 비활성화로 인해 주석 처리
  function isProductConditionMatched(condition) {
    if (!condition.product?.id) return false;

    // 1차: id 매칭, 단 세트 구성품은 제외 (단품 전용 매칭)
    const linesById = cartLines.filter((line) => {
      if (line?.merchandise?.product?.id !== condition.product.id) return false;
      const isPartOfBundle = !!getBundleGroupId(line);
      return !isPartOfBundle;
    });

    let productLines = linesById;

    // 2차: id 매칭 결과가 없으면 (=조건이 세트 자체를 가리켜 카트에 그 id가 없는 경우) 타이틀 폴백
    if (!productLines.length && condition.product.title) {
      productLines = cartLines.filter((line) => {
        const bundleTitle = getBundleTitle(line);
        return bundleTitle && bundleTitle === condition.product.title;
      });
    }

    const productQuantity = getEffectiveQuantity(productLines);

    return productQuantity >= Number(condition.productQuantity || 1);
  }

  function isCollectionConditionMatched(condition) {
    if (!condition.collection?.id) return false;

    const collectionLines = cartLines.filter((line) => {
      const productId = line?.merchandise?.product?.id;

      if (isGiftProduct(productId)) return false;
      if (productId === EGIFT_PRODUCT_ID) return false;

      const product = productsWithCollections.find((p) => p.id === productId);
      return product?.collections?.nodes?.some(
        (collection) => collection.id === condition.collection.id
      );
    });
    console.log("[GWP DEBUG] collectionLines 상세", collectionLines.map(line => ({
      productId: line?.merchandise?.product?.id,
      quantity: line.quantity,
      bundleGroupId: (line.attributes || []).find(a => a.key === "_bundle_group_id")?.value || null,
    })));
    console.log("[GWP DEBUG] collectionLines 필터 통과 라인", collectionLines.map(l => ({
      productId: l?.merchandise?.product?.id,
      quantity: l.quantity,
      bundleGroupId: getBundleGroupId(l),
    })));

    const collectionQuantity = getEffectiveQuantity(collectionLines); // reduce 대체

    if (collectionQuantity < Number(condition.collectionQuantity || 1)) {
      return false;
    }

    if (condition.collectionOnly) {
      if (condition.currencyCode !== currencyCode) return false;

      const collectionAmount = collectionLines.reduce((sum, line) => {
        return sum + Number(line?.cost?.totalAmount?.amount || 0);
      }, 0);

      return collectionAmount >= Number(condition.thresholdAmount || 0);
    }

    return true;
  }
  */

  function isConditionMatched(condition) {
    const amountOk =
      !conditionTypes.includes("amount") || isAmountConditionMatched(condition);
    // GWP condition type: product/collection 비활성화로 인해 주석 처리
    // const productOk =
    //   !conditionTypes.includes("product") || isProductConditionMatched(condition);
    // const collectionOk =
    //   !conditionTypes.includes("collection") || isCollectionConditionMatched(condition);

    return amountOk;
  }

  // ────────────────────────────────────────────────────────────


  const eligibleCondition = useMemo(() => {
    if (!gwp) return null;
    if (!conditionTypes.length) return null;

    // GWP condition type: collection 비활성화로 인해 주석 처리
    // const hasCollectionCondition =
    //   conditionTypes.includes("collection") ||
    //   conditions.some((c) => c.collectionOnly);

    // if (hasCollectionCondition && collectionsLoading) return null;
    if (!isWithinCampaignPeriod(gwp.startDatetime, gwp.endDatetime)) return null;

    const filtered = conditions.filter((condition) => {
      if (conditionTypes.includes("amount")) {
        return condition.currencyCode === currencyCode;
      }
      return true;
    });

    const matched = filtered.filter(isConditionMatched);

    const sorted = matched.sort((a, b) => {
      if (conditionTypes.includes("amount")) {
        const amountDiff =
          Number(b.thresholdAmount || 0) - Number(a.thresholdAmount || 0);

        if (amountDiff !== 0) return amountDiff;

        // GWP condition type: product/collection 비활성화로 인해 주석 처리
        // if (conditionTypes.includes("collection")) {
        //   const collectionQtyDiff =
        //     Number(b.collectionQuantity || 1) - Number(a.collectionQuantity || 1);
        //   if (collectionQtyDiff !== 0) return collectionQtyDiff;
        // }

        // if (conditionTypes.includes("product")) {
        //   const productQtyDiff =
        //     Number(b.productQuantity || 1) - Number(a.productQuantity || 1);
        //   if (productQtyDiff !== 0) return productQtyDiff;
        // }

        return 0;
      }

      // if (conditionTypes.includes("product")) {
      //   return Number(b.productQuantity || 1) - Number(a.productQuantity || 1);
      // }

      // if (conditionTypes.includes("collection")) {
      //   return (
      //     Number(b.collectionQuantity || 1) - Number(a.collectionQuantity || 1)
      //   );
      // }

      return 0;
    });

    const result = sorted[0] || null;

    // ── 디버그 로그 ──────────────────────────────────────────
    console.log("[GWP DEBUG] eligibleCondition 계산 과정", {
      totalAmount,
      currencyCode,
      conditionTypes,
      allConditions: conditions.map((c) => ({
        title: c.conditionTitle,
        thresholdAmount: c.thresholdAmount,
        collectionOnly: c.collectionOnly,
        collectionId: c.collection?.id,
        collectionQuantity: c.collectionQuantity,
        currencyCode: c.currencyCode,
      })),
      afterCurrencyFilter: filtered.map((c) => c.conditionTitle),
      afterConditionMatch: matched.map((c) => c.conditionTitle),
      afterSort: sorted.map((c) => ({
        title: c.conditionTitle,
        thresholdAmount: c.thresholdAmount,
      })),
      selected: result?.conditionTitle,
    });
    // ────────────────────────────────────────────────────────

    return result;
  }, [
    gwp,
    conditions,
    conditionTypes,
    totalAmount,
    currencyCode,
    cartLines,
    collectionsLoading,
    giftProductIds,
  ]);

  // 현재 충족한 조건의 사은품 목록 (이 중 정확히 1개가 카트에 있어야 함)
  const eligibleGifts = eligibleCondition?.giftProducts || [];
  const eligibleGiftIds = eligibleGifts.map((product) => product.id);
  const eligibleGiftKey = eligibleGiftIds.join(",");

  const eligibleGiftLines = cartLines.filter((line) =>
    isEligibleGift(line?.merchandise?.product?.id)
  );

  const eligibleGiftQuantity = eligibleGiftLines.reduce(
    (sum, line) => sum + Number(line.quantity || 0),
    0
  );

  const cartGiftProductId = eligibleGiftLines[0]?.merchandise?.product?.id || null;
  const cartGiftVariantId = eligibleGiftLines[0]?.merchandise?.id || null;

  function isGiftProduct(productId) {
    return giftProductIds.includes(productId);
  }

  function isEligibleGift(productId) {
    return eligibleGiftIds.includes(productId);
  }

  // 사은품별 옵션 Select 초기값: 카트에 담긴 variant > 첫 번째 구매 가능한 variant
  useEffect(() => {
    const initial = {};
    for (const product of eligibleGifts) {
      initial[product.id] =
        product.id === cartGiftProductId && cartGiftVariantId
          ? cartGiftVariantId
          : getDefaultVariant(product)?.id;
    }
    setSelectedVariants(initial);
  }, [eligibleGiftKey, cartGiftProductId, cartGiftVariantId]);

  // 잘못된 tier의 gift 자동 제거
  useEffect(() => {
    async function syncGiftTier() {
      if (loading) return; 
      if (isRemovingRef.current) return;
      if (collectionsLoading) return;
      if (!instructions?.lines?.canRemoveCartLine) return;

      const giftLines = cartLines.filter((line) =>
        isGiftProduct(line?.merchandise?.product?.id)
      );

      const linesToRemove = giftLines.filter(
        (line) => !isEligibleGift(line?.merchandise?.product?.id)
      );

      if (!linesToRemove.length) return;

      isRemovingRef.current = true;

      try {
        for (const line of linesToRemove) {
          await shopify.applyCartLinesChange({
            type: "removeCartLine",
            id: line.id,
            quantity: line.quantity,
          });
        }
      } catch (error) {
        console.error("syncGiftTier remove error", error);
      } finally {
        isRemovingRef.current = false;
      }
    }

    syncGiftTier();
  }, [cartLines, giftProductIds, eligibleGiftKey, instructions, loading, collectionsLoading]);

  // gift는 목록 전체 기준 총 1개로 고정 (여러 사은품/variant가 담겨도 첫 라인 1개만 남김)
  useEffect(() => {
    async function normalizeGiftQuantity() {
      if (isNormalizingGiftQtyRef.current) return;
      if (isAddingRef.current) return; // Replace 진행 중에는 건너뜀
      if (!instructions?.lines?.canUpdateCartLine) return;

      if (!eligibleGiftLines.length) return;

      const [keep, ...extra] = eligibleGiftLines;

      const linesToUpdate = keep.quantity !== 1 ? [keep] : [];
      const linesToRemove = extra;

      if (linesToRemove.length && !instructions?.lines?.canRemoveCartLine) {
        // 삭제 권한이 없으면 이번 사이클은 건너뛰고 다음 변경을 기다림
        return;
      }

      if (!linesToUpdate.length && !linesToRemove.length) return;

      isNormalizingGiftQtyRef.current = true;

      try {
        for (const line of linesToUpdate) {
          await shopify.applyCartLinesChange({
            type: "updateCartLine",
            id: line.id,
            quantity: 1,
          });
        }
        for (const line of linesToRemove) {
          await shopify.applyCartLinesChange({
            type: "removeCartLine",
            id: line.id,
            quantity: line.quantity,
          });
        }
      } catch (error) {
        console.error("normalizeGiftQuantity error", error);
      } finally {
        isNormalizingGiftQtyRef.current = false;
      }
    }

    normalizeGiftQuantity();
  }, [cartLines, eligibleGiftKey, instructions]);

  // ── GWP 데이터 fetch ─────────────────────────────────────────

  async function fetchGwp() {
    const query = `
      query getGwp($handle: MetaobjectHandleInput!) {
        metaobject(handle: $handle) {
          id
          handle
          fields {
            key
            value
            reference {
              ... on Product {
                id
                title
                featuredImage { url altText }
                variants(first: 50) {
                  nodes {
                    id title availableForSale
                    price { amount currencyCode }
                    image { url altText }
                  }
                }
              }
              ... on Collection { id title handle }
              ... on Metaobject { id handle }
            }
            references(first: 20) {
              nodes {
                ... on Metaobject {
                  id
                  handle
                  fields {
                    key
                    value
                    reference {
                      ... on Product {
                        id
                        title
                        featuredImage { url altText }
                        variants(first: 50) {
                          nodes {
                            id title availableForSale
                            price { amount currencyCode }
                            image { url altText }
                          }
                        }
                      }
                      ... on Collection { id title handle }
                    }
                    references(first: 10) {
                      nodes {
                        ... on Product {
                          id title
                          featuredImage { url altText }
                          variants(first: 50) {
                            nodes {
                              id title availableForSale
                              price { amount currencyCode }
                              image { url altText }
                            }
                          }
                        }
                        ... on Collection { id title handle }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await shopify.query(query, {
        variables: {
          handle: { type: GWP_TYPE, handle: GWP_HANDLE },
        },
      });

      if (result?.errors?.length) {
        throw new Error(result.errors.map((e) => e.message).join(" / "));
      }

      const metaobject = result?.data?.metaobject;

      if (!metaobject) {
        setGwp(null);
        return;
      }

      const parsed = parseGwp(metaobject);

      // 이미지 placeholder 확인용
      console.log(
        "[GWP DEBUG] gift images",
        parsed.conditions.flatMap((c) =>
          c.giftProducts.map((p) => ({
            condition: c.conditionTitle,
            product: p.title,
            featuredImage: p.featuredImage?.url || null,
            variantImages: p.variants.nodes.map((v) => v.image?.url || null),
          }))
        )
      );

      setGwp(parsed);
    } catch (error) {
      console.error("fetchGwp error", error);
      setGwp(null);
    } finally {
      setLoading(false);
    }
  }

  /* GWP condition type: collection 비활성화로 인해 주석 처리
  async function fetchProductCollections(ids) {
    setCollectionsLoading(true);

    const query = `
      query getProductCollections($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            collections(first: 50) {
              nodes { id handle title }
            }
          }
        }
      }
    `;

    try {
      const result = await shopify.query(query, {
        variables: { ids },
      });

      if (result?.errors?.length) {
        throw new Error(result.errors.map((e) => e.message).join(" / "));
      }

      setProductsWithCollections(result?.data?.nodes?.filter(Boolean) || []);
    } catch (error) {
      console.error("fetchProductCollections error", error);
      setProductsWithCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  }
  */

  // ── 파싱 ─────────────────────────────────────────────────────

  function parseGwp(metaobject) {
    const fields = getFieldsMap(metaobject.fields);
    const conditionNodes =
      metaobject.fields.find((f) => f.key === "conditions")?.references?.nodes || [];

    return {
      id: metaobject.id,
      handle: metaobject.handle,
      title: fields.title,
      startDatetime: fields.start_datetime,
      endDatetime: fields.end_datetime,
      conditionTypes: parseConditionTypes(fields.condition_type),
      conditions: conditionNodes.map(parseCondition),
    };
  }

  function parseCondition(metaobject) {
    const fields = getFieldsMap(metaobject.fields);

    return {
      id: metaobject.id,
      handle: metaobject.handle,
      conditionTitle: fields.condition_title,
      thresholdAmount: fields.threshold_amount,
      currencyCode: "USD",
      // GWP condition type: product/collection 비활성화로 인해 주석 처리
      // product: getReferenceByKey(metaobject.fields, "product"),
      // productQuantity: fields.product_quantity,
      // collection: getReferenceByKey(metaobject.fields, "collection"),
      // collectionOnly: fields.collection_only === "true",
      // collectionQuantity: fields.collection_quantity,
      giftProducts: toGiftList(metaobject.fields),
    };
  }

  // 사은품은 항상 배열: 1개면 단일 사은품, 2개 이상이면 N개 중 1개 선택
  function toGiftList(fields) {
    const listField = fields.find((f) => f.key === "gift_products");
    return (listField?.references?.nodes || []).filter((p) => p?.id);
  }

  function getDefaultVariant(product) {
    const variants = product?.variants?.nodes || [];
    return variants.find((variant) => variant.availableForSale) || variants[0];
  }

  function parseConditionTypes(value) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }

  function getFieldsMap(fields) {
    return fields.reduce((acc, field) => {
      acc[field.key] = field.value;
      return acc;
    }, {});
  }

  function getReferenceByKey(fields, key) {
    const field = fields.find((f) => f.key === key);
    return field?.reference || field?.references?.nodes?.[0] || null;
  }

  function isWithinCampaignPeriod(startDatetime, endDatetime) {
    const now = new Date();

    if (startDatetime) {
      const start = new Date(startDatetime);
      if (now < start) return false;
    }

    if (endDatetime) {
      const end = new Date(endDatetime);
      if (now > end) return false;
    }

    return true;
  }

  // ── 카트 유틸 ────────────────────────────────────────────────

  function isInCart(variantId) {
    return cartLines.some((line) => line.merchandise.id === variantId);
  }

  async function addToCart(variantId) {
    if (isAddingRef.current) return;

    isAddingRef.current = true;
    setIsAdding(true);

    try {
      await shopify.applyCartLinesChange({
        type: "addCartLine",
        merchandiseId: variantId,
        quantity: 1,
      });
    } finally {
      isAddingRef.current = false;
      setIsAdding(false);
    }
  }

  // 기존 사은품 라인 제거 후 새 variant 추가
  async function replaceGift(variantId) {
    if (isAddingRef.current) return;

    isAddingRef.current = true;
    setIsAdding(true);

    try {
      for (const line of eligibleGiftLines) {
        await shopify.applyCartLinesChange({
          type: "removeCartLine",
          id: line.id,
          quantity: line.quantity,
        });
      }
      await shopify.applyCartLinesChange({
        type: "addCartLine",
        merchandiseId: variantId,
        quantity: 1,
      });
    } catch (error) {
      console.error("replaceGift error", error);
    } finally {
      isAddingRef.current = false;
      setIsAdding(false);
    }
  }

  function handleVariantChange(productId, variantId) {
    setSelectedVariants((prev) => ({ ...prev, [productId]: variantId }));
  }

  // ── Buyer Journey Intercept ──────────────────────────────────

  useBuyerJourneyIntercept(({ canBlockProgress }) => {
    if (!canBlockProgress) return { behavior: "allow" };
    if (loading || collectionsLoading) return { behavior: "allow" };
    if (!eligibleCondition) return { behavior: "allow" };

    // 목록 중 정확히 1개 (quantity 합산)
    if (eligibleGiftQuantity === 0) {
      return {
        behavior: "block",
        reason: "Please select your complimentary anniversary gift before completing checkout.",
      };
    }

    if (eligibleGiftQuantity > 1) {
      return {
        behavior: "block",
        reason: "Only one complimentary gift can be added per order.",
      };
    }

    return { behavior: "allow" };
  });


  if (loading || collectionsLoading) {
    return (
      <s-box background="subdued" borderRadius="base" borderWidth="base" padding="base">
        <s-stack direction="inline" gap="small-100" alignItems="center">
          <s-spinner />
          <s-text>Loading gift…</s-text>
        </s-stack>
      </s-box>
    );
  }

  if (!eligibleCondition) return null;
  if (!eligibleGifts.length) return null;

  const isMultiGift = eligibleGifts.length > 1;

  // 사은품 1개: 담은 뒤에는 기존처럼 숨김 (옵션 변경은 line edit 기능 사용)
  if (!isMultiGift && eligibleGiftLines.length) return null;

  // 사은품 1개: 기존 레이아웃 (이미지 | 옵션 Select + ADD)
  function renderSingleGift(product) {
    const variants = product.variants.nodes;
    const selectedVariantId =
      selectedVariants[product.id] || getDefaultVariant(product)?.id;
    const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);

    if (!selectedVariant) return null;

    return (
      <s-grid
        gridTemplateColumns="auto minmax(0, 1fr)"
        gap="base"
        alignItems="center"
      >
        <s-product-thumbnail
          src={selectedVariant?.image?.url || product.featuredImage?.url}
        />

        <s-grid
          gridTemplateColumns="minmax(0, 1fr) auto"
          gap="small-100"
          alignItems="end"
        >
          <s-box minInlineSize="0">
            <s-select
              label="Option"
              value={selectedVariantId}
              onChange={(event) =>
                handleVariantChange(product.id, event.target.value)
              }
            >
              {variants.map((variant) => (
                <s-option key={variant.id} value={variant.id}>
                  {variant.title}
                </s-option>
              ))}
            </s-select>
          </s-box>

          {isInCart(selectedVariantId) ? (
            <s-box>
              <s-text>1 item added</s-text>
            </s-box>
          ) : (
            <s-button
              size="small"
              variant="primary"
              disabled={
                isAdding ||
                !selectedVariant?.availableForSale ||
                !instructions?.lines?.canAddCartLine
              }
              onClick={() => addToCart(selectedVariantId)}
            >
              ADD
            </s-button>
          )}
        </s-grid>
      </s-grid>
    );
  }

  // 사은품 2개 이상 카드: 이미지 | 상품명 + 옵션 Select | 버튼
  function renderGiftRow(product) {
    const variants = product.variants.nodes;
    const selectedVariantId =
      selectedVariants[product.id] || getDefaultVariant(product)?.id;
    const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);

    if (!selectedVariant) return null;

    const isSelectedInCart = isInCart(selectedVariantId);
    const hasOtherGift = !isSelectedInCart && eligibleGiftLines.length > 0;

    // 담긴 사은품 카드는 두꺼운 테두리 + 흰 배경 + 체크 배지로 강조
    return (
      <s-box
        key={product.id}
        background={isSelectedInCart ? "base" : undefined}
        borderWidth={isSelectedInCart ? "large-100" : "base"}
        borderRadius="base"
        padding="base"
      >
        {/* 이미지 | 상품명 / (옵션 Select + 버튼 같은 줄) */}
        <s-grid
          gridTemplateColumns="auto minmax(0, 1fr)"
          gap="base"
          alignItems="center"
        >
          <s-product-thumbnail
            src={selectedVariant?.image?.url || product.featuredImage?.url}
          />

          <s-box minInlineSize="0">
            <s-stack gap="small-200">
              <s-text emphasis="bold">{product.title}</s-text>

              {/* 버튼 칸은 내용 크기만 차지 → 옵션 Select가 남는 폭을 채움 */}
              <s-grid
                gridTemplateColumns="minmax(0, 1fr) auto"
                gap="small-100"
                alignItems="center"
              >
                <s-box minInlineSize="0">
                  <s-select
                    label="Option"
                    value={selectedVariantId}
                    onChange={(event) =>
                      handleVariantChange(product.id, event.target.value)
                    }
                  >
                    {variants.map((variant) => (
                      <s-option key={variant.id} value={variant.id}>
                        {variant.title}
                      </s-option>
                    ))}
                  </s-select>
                </s-box>

                {isSelectedInCart ? (
                  <s-stack direction="inline" alignItems="center" gap="small-200">
                    <s-icon type="check-circle" tone="success" size="small" />
                    <s-text tone="success">Added</s-text>
                  </s-stack>
                ) : hasOtherGift ? (
                  <s-button
                    inlineSize="fit-content"
                    variant="secondary"
                    disabled={
                      isAdding ||
                      !selectedVariant?.availableForSale ||
                      !instructions?.lines?.canAddCartLine ||
                      !instructions?.lines?.canRemoveCartLine
                    }
                    onClick={() => replaceGift(selectedVariantId)}
                  >
                    Replace
                  </s-button>
                ) : (
                  <s-button
                    inlineSize="fit-content"
                    variant="primary"
                    disabled={
                      isAdding ||
                      !selectedVariant?.availableForSale ||
                      !instructions?.lines?.canAddCartLine
                    }
                    onClick={() => addToCart(selectedVariantId)}
                  >
                    ADD
                  </s-button>
                )}
              </s-grid>
            </s-stack>
          </s-box>
        </s-grid>
      </s-box>
    );
  }

  return (
    <s-box background="subdued" borderRadius="base" borderWidth="base" padding="base">
      <s-section>
        <s-stack gap="small-100">
          <s-text size="medium" emphasis="bold">
            YOUR COMPLIMENTARY GIFT
          </s-text>

          {isMultiGift ? (
            <s-box paddingBlockEnd="small-100">
              <s-text>Choose 1 of {eligibleGifts.length} complimentary gifts.</s-text>
            </s-box>
          ) : (
            <s-stack gap="none">
              <s-text>Your order is eligible for the gift below.</s-text>
              <s-text>Select your option to add it to your order.</s-text>
            </s-stack>
          )}

          {isMultiGift ? (
            <s-stack gap="small-100">
              {eligibleGifts.map((product) => renderGiftRow(product))}
            </s-stack>
          ) : (
            renderSingleGift(eligibleGifts[0])
          )}
        </s-stack>
      </s-section>
    </s-box>
  );
}