import type { DigitEyesFixture } from './types';

/** Cheerios — contrôle négatif non vidéo, réponse réelle du 2026-10-06
 * (`usage` tronqué à sa première phrase ; `categories` intégral). Aucune
 * catégorie vidéo ; image `http://` (redirige vers HTTPS). */
export const DIGITEYES_CHEERIOS: DigitEyesFixture = {
  barcode: '016000487727',
  response: {
    upc_code: '0016000487727',
    return_code: '0',
    return_message: 'Success',
    description: 'General Mills Cheerios 340G',
    brand: 'General Mills',
    categories:
      "Adult Breakfast Cereal, All Products, Assets Img Branddefault Gif, Available Items, Best Selling, Breakfast, Breakfast & Cereal, Breakfast & Cereal Bars, Breakfast Cereal, Breakfast Cereals, Cereal, Cereal & Granola, Cereal & Oatmeal, Cereal & Protein Bars, Cereal Cold, Cereals, Cereals & Muesli, Cheerios Cereal 12 Oz Box, Cheerios Cereal 340G Usa, Cheerios Gluten Free Cereal 12 Oz, Children's Cereals, Cold Cereal, Cold Cereals, Cold Cereals & Granola, Confectionery & Snacks, Cooking & Baking, Food, Food & Grocery, Food Beverage, Food Beverages & Tobacco, Food Items, General Mills Cereals, General Mills Inc, Gluten Free, Grains Rice & Cereals, Groceries, Grocery, Grocery & Snacks, Grocery Food, Healthcentralusa, Instant Mixes, Kosher, Misc, Nerdcandy, Non, Oat Cereal, Ocf, Other, Other Cold Cereal, Pantry, Ready To Eat, Refrigerated Food, Shop, Shop By Brand, Shop By Brand G, Snacks, Special Offers, Wegmans Food Markets Inc, Whole Grain, Whole Grain Cereal, Wic Cereal Whole Grain, Wix",
    image: 'http://www.partridges.co.uk/cdn/shop/files/GeneralMillsCheerios340g.jpg?v=1741685105',
    usage: 'Good goes aroundFrom your first finger food, to helping lower cholesterol.',
    uom: '12 ounces',
    manufacturer: { company: 'General Mills' },
  },
};
