using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore; // 1. 記得引用這個，才能用 ToListAsync
using _0119trip.Models;

namespace _0119trip.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly TravelDbContext _context; // 2. 宣告資料庫變數

    // 3. 在建構子注入資料庫 Context
    public HomeController(ILogger<HomeController> logger, TravelDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    // 4. 修改 Index，撈取資料庫的 Trips
    public async Task<IActionResult> Index()
    {
        // 撈出所有旅程，並包含 TripMembers (為了計算人數)
        // 注意：如果您還沒設定好 TripMembers 關聯，可以先拿掉 .Include(...)
        var trips = await _context.Trips
                                  .Include(t => t.TripMembers)
                                  .ToListAsync();

        return View(trips); // 將資料傳給 View
    }

    public async Task<IActionResult> Detail(int? id)
    {
        if (id == null) return NotFound();

        // 從資料庫撈出 ID 相符的那筆旅程
        var trip = await _context.Trips
                                 .FirstOrDefaultAsync(m => m.Id == id);

        if (trip == null) return NotFound();

        return View(trip); // 將撈到的 trip 資料傳給 View
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}