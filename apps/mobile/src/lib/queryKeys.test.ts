import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('namespace chaque clé par userId : deux comptes ne peuvent jamais partager une entrée de cache pour le même household', () => {
    const householdId = 'h1';

    expect(queryKeys.households('user-a')).not.toEqual(queryKeys.households('user-b'));
    expect(queryKeys.members('user-a', householdId)).not.toEqual(
      queryKeys.members('user-b', householdId),
    );
    expect(queryKeys.categories('user-a', householdId)).not.toEqual(
      queryKeys.categories('user-b', householdId),
    );
    expect(queryKeys.itemsRoot('user-a', householdId)).not.toEqual(
      queryKeys.itemsRoot('user-b', householdId),
    );
    expect(queryKeys.items('user-a', householdId, {})).not.toEqual(
      queryKeys.items('user-b', householdId, {}),
    );
    expect(queryKeys.item('user-a', householdId, 'item-1')).not.toEqual(
      queryKeys.item('user-b', householdId, 'item-1'),
    );
    expect(queryKeys.stats('user-a', householdId)).not.toEqual(
      queryKeys.stats('user-b', householdId),
    );
    expect(queryKeys.invitations('user-a', householdId)).not.toEqual(
      queryKeys.invitations('user-b', householdId),
    );
  });

  it('deux households différents pour un même utilisateur restent des entrées distinctes', () => {
    expect(queryKeys.items('user-a', 'h1', {})).not.toEqual(queryKeys.items('user-a', 'h2', {}));
    expect(queryKeys.members('user-a', 'h1')).not.toEqual(queryKeys.members('user-a', 'h2'));
  });
});
