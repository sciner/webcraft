# Управление игроком

## Синхронизация действий

Цель - чтобы изменения состояния игрока, сделанные не из `PlayerControlManager`, на клиенте и серевере встроились в одно место последовательности тиков управления. Это чтобы коррекциий не было, или они были бы менее заметы. Это возможно только если клиент инициирует действие, и ожидает что сервер его выполнит.

Общий алгоритм синхронизации.
1. Клиент получает id очередного события - из `PickAt.getNextId`. Даже если оно не связано с `PickAt` - просто используется тот счетчик.
2. (необязательно) Клиент локально производит действия над игроком, например, садит его на стул.
3. Клиент вызывает один из методов `ClientPlayerContorlManager.syncWith***()` и передает туда id события
3.1 `ClientPlayerContorlManager` запоминает это
3.2 В ближайшем `ClientPlayerContorlManager.update()`, клиент создает и посылает специальный `PlayerTickData`, содержащий в `inputEventIds` id события. Семантика этого пакета: "сервер, задержись пока не выполнится событие с этим id, а потом скажи мне результат"
4. Любым сопособом (вне подсистемы управления) клиент отправляет на сервер команду действия, содержащую этот id.
5. Сервер при получении этого `PlayerTickData` приостанавливает управление пока другая серверная подсистема не сообщит в `ServerPlayerContorlManager` что это событие обработано.
6. Другая серверная подсистема получает команду действия, пытается ее выполнить, и, независимо от результата, сообщает об ее окнчании в `ServerPlayerContorlManager`
7. Когда в `ServerPlayerContorlManager` имеет и `PlayerTickData`, и сообщение о выполнении события с таким id, управление продолжается, и сервер шлет клиенту ответ (подтверждение или коррекцию).

Порядк выполненяи шагов 3 и 4 не важен.
Порядк выполненяи шагов 5 и 6 не важен.

2 сценария синхронизации:
1. Клиент выполняет действие (например, садится на стул) и ожидает что сервер выполнит то же действие с тем же результатом.
2. Клиент заказывает действие у сервера (например, посадку на моба), но локально его не выполняет.

Клиент может отключить свое управление (и вообще симуляцию физики) до получения ответа с сервера. Например, если он послал команду сесть на моба - нет смылса продолжать свободно бегать без моба пока сервер не ответит.