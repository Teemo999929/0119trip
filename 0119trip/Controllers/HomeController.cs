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

        var trip = await _context.Trips
            .Include(t => t.TripMembers)             // 1. 撈出旅程成員關聯表
                .ThenInclude(tm => tm.User)        // 2. 再撈出成員對應的使用者資料 (AspNetUsers)
                .Include(t => t.Expenses).ThenInclude(e => e.Category)

                .Include(t => t.Expenses)
                .ThenInclude(e => e.ExpensePayers)
                .ThenInclude(ep => ep.Member)
                    .ThenInclude(m => m.User)  //撈出付款人資訊

                    //撈出分攤人資訊 (為了算個人花費)
                    .Include(t => t.Expenses)
            .ThenInclude(e => e.ExpenseParticipants)
                .ThenInclude(ep => ep.User) // 注意：您的 Model 裡屬性叫 User，但型別是 TripMember
                    .ThenInclude(tm => tm.User) // 再連一層到 AspNetUser

            .FirstOrDefaultAsync(m => m.Id == id);

        if (trip == null) return NotFound();

        return View(trip);
    }
    // --- 新增：處理刪除支出 ---
    [HttpPost]
    public async Task<IActionResult> DeleteExpense(int id)
    {
        var expense = await _context.Expenses.FindAsync(id);
        if (expense != null)
        {
            _context.Expenses.Remove(expense);
            await _context.SaveChangesAsync();
            return Json(new { success = true });
        }
        return Json(new { success = false, message = "找無此資料" });
    }

    // --- 新增：處理 建立 或 編輯 支出 ---
    [HttpPost]
    public async Task<IActionResult> SaveExpense(int? id, int tripId, string title, decimal amount, DateTime date, int categoryId)
    {
        try
        {
            // 1. 計算是旅程的第幾天 (Day)
            var trip = await _context.Trips.FindAsync(tripId);
            if (trip == null) return Json(new { success = false, message = "旅程不存在" });

            // 計算天數差 (Date - StartDate) + 1
            int dayNumber = (date.Date - trip.StartDate.ToDateTime(TimeOnly.MinValue)).Days + 1;
            if (dayNumber < 1) dayNumber = 1; // 防止日期選錯

            // 將 expense 宣告為 nullable，避免 CS8600 警告
            Expense? expense;
            if (id.HasValue && id.Value > 0)
            {
                // --- 編輯模式 ---
                expense = await _context.Expenses.FindAsync(id.Value);
                if (expense == null) return Json(new { success = false, message = "找無此支出" });
            }
            else
            {
                // --- 新增模式 ---
                expense = new Expense();
                expense.TripId = tripId;
                _context.Expenses.Add(expense);
            }

            // 更新欄位
            expense.Title = title;
            expense.Amount = amount;
            expense.Day = dayNumber;
            expense.CategoryId = categoryId; // 這裡假設前端傳來的是 CategoryId (1~6)

            await _context.SaveChangesAsync();
            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            return Json(new { success = false, message = ex.Message });
        }
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