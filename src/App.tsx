import React from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Admin from "./pages/Admin";

export default function App() {
  const loc = useLocation();
  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" />
          <div>
            <p className="h1">BirthPay</p>
            <p className="sub">Pedidos + reparto automático + control de pagos</p>
          </div>
        </div>
        <div className="nav">
          <Link className={`btn ${loc.pathname === "/" ? "primary" : ""}`} to="/">Evento</Link>
          <Link className={`btn ${loc.pathname.startsWith("/admin") ? "primary" : ""}`} to="/admin">Administración</Link>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  );
}
