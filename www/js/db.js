/*
    // Проверяем существования префикса.
    window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    // НЕ ИСПОЛЬЗУЙТЕ "let indexedDB = ..." вне функции.
    // также могут отличаться и window.IDB* objects: Transaction, KeyRange и тд
    window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
    window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
    // (Mozilla никогда не создавала префиксов для объектов, поэтому window.mozIDB* не требуется проверять)
    if (!window.indexedDB) {
        window.alert("Ваш браузер не поддерживает стабильную версию IndexedDB. Такие-то функции будут недоступны");
    }
*/
const DB = {
    open: null,
    db: null,
    open: function(table_name, onsuccess) {
        let that = this;
        let indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
        that.open = indexedDB.open('webcraft_saves', 1);
        // Create the schema
        that.open.onupgradeneeded = function() {
            console.log('onupgradeneeded');
            that.db = that.open.result;
            let store = that.db.createObjectStore(table_name, {keyPath: '_id'});
            // let index = store.createIndex("NameIndex", ['name.last', 'name.first']);
        };
        that.open.onsuccess = function() {
            // Start a new transaction
            that.db = that.open.result;
            onsuccess(that);
        }
    },
    put: function(table_name, value) {
        let tx = this.db.transaction(table_name, 'readwrite');
        let store = tx.objectStore(table_name);
        return store.put(value);
    },
    get: function(table_name, id, onsuccess, onerror) {
        // Query the data
        let tx = this.db.transaction(table_name, 'readwrite');
        let store = tx.objectStore(table_name);
        id = id ? id : '__notfoundid__'
        let request = store.get(id);
        request.onsuccess = function(event) {
            if (request.result !== undefined) {
                onsuccess(request.result);
            } else {
                onerror(event);
            }
        };
        request.onerror = function(err) {
            onerror(err);
        };
    },
    delete: function(table_name, id, callback) {
        // Query the data
        let tx = this.db.transaction(table_name, 'readwrite');
        let store = tx.objectStore(table_name);
        return store.delete(id);
    }
};

export default DB;