"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
}

interface ToastContextType {
	toasts: Toast[];
	showToast: (message: string, type?: ToastType) => void;
	removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	const showToast = useCallback(
		(message: string, type: ToastType = "info") => {
			const id = Math.random().toString(36).substring(2, 9);
			setToasts((prev) => [...prev, { id, message, type }]);

			// Auto-dismiss after 5 seconds
			setTimeout(() => {
				removeToast(id);
			}, 5000);
		},
		[removeToast],
	);

	return (
		<ToastContext.Provider value={{ toasts, showToast, removeToast }}>
			{children}
		</ToastContext.Provider>
	);
};
