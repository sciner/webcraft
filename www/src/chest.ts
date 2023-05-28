
/** Действия над (инвентарем + сундуком) */
export enum CHEST_CHANGE {
    NONE,
    SLOTS,  // it may be adding or subtracting drag item from a slot, if slotIndex >= 0
    MERGE_SMALL_STACKS,
    SHIFT_SPREAD,
    SORT
}

/** Описывает действией над (инвентарем + сундуком), которое сервер должен произвести по просьбе клиента */
export type TChestChange = {
    type            : CHEST_CHANGE,

    // Слот сундука или инвентаря, учатсвующий в изменении
    slotIndex       : int,
    slotInChest     : boolean,
    slotPrevItem    : IInventoryItem | null,    // значение слота до изменения

    dragPrevItem    : IInventoryItem | null,    // значение drag слота до изменения

    prevInventory   : (IInventoryItem | null)[] | null  // значение инвентаря до изменения
}

export type TOneChestConfirmData = {
    pos     : IVector
    slots   : Dict<IInventoryItem>
}

/** Сообщение серверу о действиях над (инвентарем + сундуком) */
export type TChestConfirmData = {
    chestSessionId  : number
    requestId ?     : int       // если задачно, то клиент ожидает CMD_CHEST_CHANGE_PROCESSED, а сервер ее пошлет
    change          : TChestChange
    chest           : TOneChestConfirmData
    secondChest ?   : TOneChestConfirmData
    inventory_slots : (IInventoryItem | null)[] // Инвентарь, который по мнению клиента должен получиться после изменения
}

/** Данные {@link ServerClient.CMD_CHEST_CONTENT} */
export type TCmdChestContent = {
    pos:    IVector
    slots:  Dict<IInventoryItem>,
    state?: Dict
}