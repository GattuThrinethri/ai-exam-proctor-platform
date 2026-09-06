import AdminLayout from "@/components/admin/AdminLayout";

export const metadata = {
  title: "Admin Portal - IntelliExam",
  description: "Platform governance, user management, and security oversight.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
