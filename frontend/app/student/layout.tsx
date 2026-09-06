import StudentLayout from "@/components/student/StudentLayout";

export const metadata = {
  title: "Student Portal - IntelliExam",
  description: "Take online proctored examinations and view detailed performance analytics.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StudentLayout>{children}</StudentLayout>;
}
