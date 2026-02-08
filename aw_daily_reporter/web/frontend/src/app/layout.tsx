import type { Metadata } from "next";
import "./globals.css";

import { ConfigInitializer } from "@/components/ConfigInitializer";
import { NoSSRHeader } from "@/components/NoSSRHeader";
import { ToastContainer } from "@/components/ToastContainer";
import { I18nProvider } from "@/contexts/I18nContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ThemeProvider } from "@/providers/ThemeProvider";

export const metadata: Metadata = {
	title: "AW Daily Reporter",
	description: "ActivityWatch Daily Reporter UI",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="antialiased min-h-screen bg-base-100 text-base-content transition-colors duration-300">
				<I18nProvider>
					<ThemeProvider
						attribute="data-theme"
						defaultTheme="system"
						enableSystem
					>
						<ToastProvider>
							<ConfigInitializer />
							<NoSSRHeader />
							<main>{children}</main>
							<ToastContainer />
						</ToastProvider>
					</ThemeProvider>
				</I18nProvider>
			</body>
		</html>
	);
}
