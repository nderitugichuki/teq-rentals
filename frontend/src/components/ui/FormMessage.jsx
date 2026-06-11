export function FormMessage({ message }) {
  if (!message) return null;

  const isError = message.type === "error";

  return (
    <div className={`mt-4 rounded-md px-3 py-2 text-sm ${isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
      {message.text}
    </div>
  );
}

