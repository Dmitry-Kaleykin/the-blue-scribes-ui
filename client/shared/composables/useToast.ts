import { ref } from 'vue';

const toast = ref<{ tone: 'success' | 'danger'; message: string } | undefined>(undefined);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function useToast() {
    function showToast(tone: 'success' | 'danger', message: string): void {
        toast.value = { tone, message };
        if (toastTimer) {
            clearTimeout(toastTimer);
        }
        toastTimer = setTimeout(() => {
            toast.value = undefined;
        }, 5000);
    }

    function dismissToast(): void {
        toast.value = undefined;
        if (toastTimer) {
            clearTimeout(toastTimer);
            toastTimer = undefined;
        }
    }

    return { toast, showToast, dismissToast };
}