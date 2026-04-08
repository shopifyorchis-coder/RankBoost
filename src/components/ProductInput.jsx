function ProductInput() {
  return (
    <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        RankBoost
      </h1>

      <form className="mt-8 space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="product-title"
            className="block text-sm font-medium text-slate-700"
          >
            Product Title
          </label>
          <input
            id="product-title"
            type="text"
            placeholder="Enter your product title..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="product-description"
            className="block text-sm font-medium text-slate-700"
          >
            Product Description
          </label>
          <textarea
            id="product-description"
            rows="5"
            placeholder="Enter your product description..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="product-tags"
            className="block text-sm font-medium text-slate-700"
          >
            Tags
          </label>
          <input
            id="product-tags"
            type="text"
            placeholder="Enter tags separated by commas e.g. shoes, running, sport"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <button
          type="button"
          className="inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Analyze
        </button>
      </form>
    </section>
  )
}

export default ProductInput
