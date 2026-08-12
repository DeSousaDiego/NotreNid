import { useLocalSearchParams } from 'expo-router';

import { ItemFormScreen } from '../../../../screens/item-form/ItemFormScreen';

export default function EditItemScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  return <ItemFormScreen mode="edit" itemId={itemId} />;
}
