class QueuePage {
    constructor(size, bytesPerElement = 4) {
        this.size = size;
        if (bytesPerElement === 4) {
            this.arr = new Uint32Array(size);
        } else {
            this.arr = new Uint16Array(size);
        }
        this.arr = new Uint32Array(size);
        this.clear();
    }

    clear() {
        this.start = this.finish = 0;
        this.next = null;
    }
}

export class QueuePagePool {
    constructor({pageSize, bytesPerElement = 4}) {
        this.pageSize = pageSize;
        this.pages = [];
        this.freePageStack = [];
        this.freePageCount = 0;
        this.bytesPerElement = bytesPerElement;
    }

    alloc() {
        if (this.freePageCount === 0) {
            this.pages.push(new QueuePage(this.pageSize, this.bytesPerElement));
            this.freePageStack.push(null);
            this.freePageStack[0] = this.pages[this.pages.length - 1];
            this.freePageCount++;
        }
        return this.freePageStack[--this.freePageCount];
    }

    free(page) {
        page.clear();
        this.freePageStack[this.freePageCount++] = page;
    }
}

export class SingleQueue {
    constructor({pagePool, priority = 0}) {
        this.pagePool = pagePool;
        this.priority = priority;
        this.head = null;
        this.tail = null;
    }

    clear() {
        this.priority = 0;
        while (this.head) {
            this.freeHeadPage();
        }
    }

    countPages() {
        let res = 0;
        let test = this.head;
        while (test) {
            res++;
            test = test.next;
        }
        return 0;
    }

    push(value) {
        let curPage = this.tail;
        if (curPage && curPage.finish < curPage.size) {
            curPage.arr[curPage.finish++] = value;
            return;
        }

        const newPage = this.pagePool.alloc();
        if (newPage.next) {
            console.log("WTFWTFWTF");
        }
        newPage.arr[newPage.finish++] = value;
        if (curPage) {
            curPage.next = newPage;
        } else {
            this.head = newPage;
        }
        this.tail = newPage;
    }

    freeHeadPage() {
        const head = this.head;
        this.head = head.next;
        if (head.next === null) {
            this.tail = null;
        }
        this.pagePool.free(head);
    }

    shift() {
        const head = this.head;
        const val = head.arr[head.start++];
        if (head.start === head.finish) {
            this.freeHeadPage();
        }
        return val;
    }
}

export class MultiQueue {
    static defaultPool = null;

    static getDefaultPool(pageSize) {
        if (this.defaultPool?.pageSize === pageSize) {
            return this.defaultPool;
        }
        return null;
    }

    constructor({pageSize = 1 << 12, pagePool = null, maxPriority = 400}) {
        this.pagePool = pagePool
            || MultiQueue.getDefaultPool(pageSize)
            || new QueuePagePool({pageSize});

        this.heap = []; // heap of queues
        this.freeQueueStack = [];
        this.freeQueueCount = 0;

        this.maxPriority = maxPriority;
        this.queueMap = new Map();
        this.queues = [];
        for (let i = 0; i <= maxPriority; i++) {
            this.queues[i] = new SingleQueue({pagePool: this.pagePool, priority: i});
        }
        this.debugName = null;
    }

    peekNonEmpty() {
        let cur = this.heap[0];
        while (cur && !cur.head) {
            if (this.debugName) {
                console.log(`QUEUE ${this.debugName} ${cur.priority} done`);
            }
            this.heapPop();
            cur = this.heap[0];
        }

        /*if (cur) {
            const {heap} = this;
            for (let i=1;i<heap.length;i++) {
                if (heap[i].priority > cur.priority){
                    console.log('WTF');
                    break;
                }
            }
        }*/

        return cur;
    }

    allocQueue(priority) {
        let q = null;
        if (this.freeQueueCount === 0) {
            q = new SingleQueue({pagePool: this.pagePool, priority});
            this.freeQueueStack.push(null);
        } else {
            q = this.freeQueueStack[--this.freeQueueCount];
            this.freeQueueStack[this.freeQueueCount] = null;
            q.priority = priority;
        }
        this.queueMap.set(priority, q);
        this.heapInsert(q);
        return q;
    }

    freeQueue(q) {
        // free queue
        if (q.priority >= 0 && q.priority <= this.maxPriority) {
        } else {
            this.queueMap.delete(q.priority);
            q.clear();
            this.freeQueueStack[this.freeQueueCount++] = q;
        }
    }

    heapInsert(q) {
        const {heap} = this;
        let ind = heap.length;
        let par = (ind - 1) >> 1;
        while (par >= 0 && heap[par].priority < q.priority) {
            heap[ind] = heap[par];
            ind = par;
            par = (ind - 1) >> 1;
        }
        heap[ind] = q;
    }

    heapPeek() {
        return this.heap[0];
    }

    heapPop() {
        const {heap} = this;

        this.freeQueue(heap[0]);

        const sz = heap.length - 1;
        if (sz === 0) {
            heap.length = 0;
            return;
        }

        const h = heap[sz];
        heap[sz] = null;
        let cur = 0;
        while (cur * 2 + 1 < sz) {
            let largest = sz;
            let p = h.priority;
            if (p < heap[cur * 2 + 1].priority) {
                largest = cur * 2 + 1;
                p = heap[cur * 2 + 1].priority;
            }
            if (cur * 2 + 2 < sz && p < heap[cur * 2 + 2].priority) {
                largest = cur * 2 + 2;
            }
            if (largest === sz) break;
            heap[cur] = heap[largest];
            cur = largest;
        }
        heap[cur] = h;
        heap.length = sz;
    }

    push(priority, value) {
        let q;
        if (priority >= 0 && priority <= this.maxPriority) {
            q = this.queues[priority];
            if (!q.head) {
                this.heapInsert(q);
            }
        } else {
            q = this.queueMap.get(priority);
            if (!q) {
                q = this.allocQueue(priority);
            }
        }
        q.push(value);
    }
}
