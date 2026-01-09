"use client";

import { useState, ReactNode } from "react";
import AppLayout from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Flashbar, { FlashbarProps } from "@cloudscape-design/components/flashbar";
import { SideNav } from "../navigation/SideNav";
import { I18nProvider } from "@cloudscape-design/components/i18n";
import messages from "@cloudscape-design/components/i18n/messages/all.en";

interface DashboardLayoutProps {
  children: ReactNode;
  breadcrumbs?: { text: string; href: string }[];
  contentType?: "default" | "cards" | "table" | "wizard" | "form";
  contentHeader?: ReactNode;
  notifications?: FlashbarProps.MessageDefinition[];
}

const LOCALE = 'en';

export function DashboardLayout({
  children,
  breadcrumbs,
  contentType = "default",
  notifications = []
}: DashboardLayoutProps) {
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);

  const defaultBreadcrumbs = [
    { text: "Home", href: "/" }
  ];

  return (
    <I18nProvider locale={LOCALE} messages={[messages]}>
      <AppLayout
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        navigation={<SideNav />}
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        toolsHide={true}
        breadcrumbs={<BreadcrumbGroup items={breadcrumbs || defaultBreadcrumbs} />}
        notifications={<Flashbar items={notifications} />}
        contentType={contentType}
        content={children}
      />
    </I18nProvider>
  );
}
