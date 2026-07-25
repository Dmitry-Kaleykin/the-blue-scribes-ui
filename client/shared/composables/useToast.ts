import { ref } from 'vue';

const TRANSITION_DELAY = 300;

interface ToastItem {
    id: number;
    tone: 'success' | 'danger';
    message: string;
}

let nextId = 1;

const current = ref<ToastItem | undefined>(undefined);
const queue: ToastItem[] = [];
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

export function useToast() {
    function showToast(tone: 'success' | 'danger', message: string): void {
        const item: ToastItem = { id: nextId++, tone, message };

        if (current.value) {
            queue.push(item);
            return;
        }

        showNext(item);
    }

    function dismissToast(): void {
        clearDismissTimer();
        current.value = undefined;
        scheduleNext();
    }

    function getQueueLength(): number {
        return queue.length;
    }

    return { current, showToast, dismissToast, getQueueLength };
}

function showNext(item: ToastItem): void {
    clearDismissTimer();
    current.value = item;
    dismissTimer = setTimeout(() => {
        current.value = undefined;
        scheduleNext();
    }, 5000);
}

function scheduleNext(): void {
    setTimeout(() => {
        if (queue.length > 0) {
            const next = queue.shift();
            if (next) {
                showNext(next);
            }
        }
    }, TRANSITION_DELAY);
}

function clearDismissTimer(): void {
    if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = undefined;
    }
}