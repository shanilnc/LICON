import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../shared/api";
import { Form, Field, Select, State, useData } from "../../shared/ui";
import { PageTitle, ProductCard } from "./components";
export function Custom() {
  return (
    <main className="section">
      <PageTitle
        title="Your space. Your dimensions. Your furniture."
        eyebrow="MADE FOR YOU"
      >
        Some spaces call for something personal. Tell us what you have in mind.
      </PageTitle>
      <div className="editorial-layout">
        <img
          src="https://images.unsplash.com/photo-1538688423619-a81d3f23454b?auto=format&fit=crop&w=1000&q=85"
          alt="Warm wood and natural finishes"
        />
        <Form
          button="Send your brief ↗"
          onSubmit={async (v, form) => {
            const file = form.elements.reference.files[0];
            if (file) {
              const body = new FormData();
              body.append("image", file);
              const uploaded = await api("/uploads", { method: "POST", body });
              v.referenceImage = uploaded.url;
            }
            delete v.reference;
            await api("/custom-requests", { method: "POST", body: v });
            form.reset();
            return "Your brief is with us. We’ll be in touch.";
          }}
        >
          <div className="form-grid">
            {[
              ["name", "Name"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["furnitureType", "Furniture type"],
              ["dimensions", "Dimensions"],
              ["material", "Preferred material"],
              ["color", "Color"],
              ["budget", "Budget (₹)"],
            ].map(([name, label], i) => (
              <Field
                name={name}
                label={label}
                key={name}
                type={name === "email" ? "email" : "text"}
                required={i < 4}
              />
            ))}
          </div>
          <Field
            label="Reference image (JPG, PNG, WebP; max 5 MB)"
            name="reference"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <label className="field">
            Anything else we should know?
            <textarea name="requirements" maxLength="3000" rows="4" />
          </label>
          <p>
            Reference uploads require sign-in and configured image storage. You
            can submit a brief without an image.
          </p>
        </Form>
      </div>
    </main>
  );
}
export function Quiz() {
  const [products, setProducts] = useState(null);
  return (
    <main className="section">
      <PageTitle
        title="Find your kind of furniture."
        eyebrow="A SPACE THAT FEELS LIKE YOU"
      />
      <Form
        className="narrow compact"
        button="Find my pieces"
        onSubmit={async (v) => {
          const q = new URLSearchParams();
          if (v.room) q.set("category", v.room);
          if (v.material) q.set("material", v.material);
          if (v.budget) q.set("maxPrice", v.budget);
          setProducts((await api("/products?" + q)).items);
        }}
      >
        <Select label="Which space?" name="room">
          <option value="sofas">Living room</option>
          <option value="beds">Bedroom</option>
          <option value="tables">Workspace</option>
          <option value="small-space">Small space</option>
        </Select>
        <Select label="Budget" name="budget">
          <option value="10000">Under ₹10,000</option>
          <option value="30000">Up to ₹30,000</option>
          <option value="60000">Up to ₹60,000</option>
          <option value="">No limit</option>
        </Select>
        <Select label="Material" name="material">
          <option value="">No preference</option>
          <option value="Oak">Wood / oak</option>
          <option value="Fabric">Fabric</option>
        </Select>
      </Form>
      {products && (
        <State empty={!products.length}>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </State>
      )}
    </main>
  );
}
const defaults = {
  about: {
    title: "A quieter kind of living.",
    body: "LICON is built around a simple idea: the things we bring into our homes should earn their place. We bring together quiet forms, warm textures and considered details to make everyday spaces feel more like you.",
  },
  materials: {
    title: "Honest materials. Lasting character.",
    body: "Natural wood brings warmth and individual grain to every piece. Soft fabrics invite you to settle in. Always follow the care instructions on your chosen product. Use a soft cloth, keep timber away from standing water, and protect upholstery from direct sun.",
  },
  inspiration: {
    title: "Room to be inspired.",
    body: "Start with the way you live. Give your favourite chair a little breathing room. Bring texture into a neutral palette with fabric and wood. Choose fewer, more useful pieces and leave space for life to happen.",
  },
  policies: {
    title: "Delivery, care & returns.",
    body: "Delivery availability, fees and estimated timing are shown by PIN code before checkout. Product-specific care and warranty information appears on each product page. Final return terms and business contact details must be published by the store owner before launch.",
  },
};
export function Editorial() {
  const key = useLocation().pathname.slice(1),
    r = useData("/content/" + key),
    d = { ...defaults[key], ...r.data };
  return (
    <main className="narrow">
      <PageTitle title={d.title} eyebrow="THE LICON WAY" />
      <p className="prose">{d.body}</p>
      <Link className="button" to="/shop">
        Explore our furniture ↗
      </Link>
    </main>
  );
}
export function Contact() {
  return (
    <main className="narrow">
      <PageTitle title="Let’s make room for a conversation." />
      <Form
        button="Send message"
        onSubmit={async (v) => {
          await api("/contact", { method: "POST", body: v });
          return "Your message has been received.";
        }}
      >
        <Field label="Name" name="name" required />
        <Field label="Email" name="email" type="email" required />
        <label className="field">
          Your message
          <textarea name="message" required minLength="10" rows="5" />
        </label>
      </Form>
    </main>
  );
}
export function Forgot() {
  return (
    <main className="narrow">
      <PageTitle title="Let’s get you back home." />
      <p>
        Automated password reset is not enabled yet. Contact the store for
        account assistance.
      </p>
      <Link className="button" to="/contact">
        Contact support
      </Link>
    </main>
  );
}
