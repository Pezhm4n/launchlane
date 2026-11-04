var app = WebApplication.CreateBuilder(args).Build();
app.MapGet("/api/orders", () => Results.Json(new { total = Invoice.Total((17m, 3), (8m, 0), (11m, 2)) }));
app.MapGet("/orders/summary", () => $"invoice:{Invoice.Total((17m, 3), (8m, 0), (11m, 2))}");
app.Run();
