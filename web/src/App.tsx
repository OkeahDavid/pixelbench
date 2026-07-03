import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Benchmark } from "./pages/Benchmark";
import { Methodology } from "./pages/Methodology";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Benchmark />} />
        <Route path="methodology" element={<Methodology />} />
      </Route>
    </Routes>
  );
}
