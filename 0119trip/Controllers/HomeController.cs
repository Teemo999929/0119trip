using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore; // 1. 記得引用這個，才能用 ToListAsync
using _0119trip.Models;
using System.Text.Json;

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
            .Include(t => t.TripMembers).ThenInclude(tm => tm.User)  // 撈出成員對應的使用者資料 (AspNetUsers)
                .Include(t => t.Expenses).ThenInclude(e => e.Category)
                    //撈出付款人資訊
                .Include(t => t.Expenses)
                    .ThenInclude(e => e.ExpensePayers)
                    .ThenInclude(ep => ep.Member)
                    .ThenInclude(m => m.User)  

                    //撈出分攤人資訊 (為了算個人花費)
                .Include(t => t.Expenses)
                    .ThenInclude(e => e.ExpenseParticipants)
                    .ThenInclude(ep => ep.User) // 注意：您的 Model 裡屬性叫 User，但型別是 TripMember
                    .ThenInclude(tm => tm.User) // 再連一層到 AspNetUser

            .FirstOrDefaultAsync(m => m.Id == id);

        if (trip == null) return NotFound();

        // 撈取所有類別傳給 View (用於下拉選單)
        ViewBag.Categories = await _context.Categories.ToListAsync();
        return View(trip);
    }
    // --- 處理刪除支出 ---
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

    // --- 處理 建立 或 編輯 支出 ---
    [HttpPost]
    public async Task<IActionResult> SaveExpense(int? id, int tripId, string title, decimal amount, DateTime date, int categoryId, string payersJson, string partsJson)
    {
        // 開啟交易模式
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // 1. 驗證旅程
            var trip = await _context.Trips.FindAsync(tripId);
            if (trip == null) return Json(new { success = false, message = "旅程不存在" });

            // 2. 計算天數
            int dayNumber = (date.Date - trip.StartDate.ToDateTime(TimeOnly.MinValue)).Days + 1;
            if (dayNumber < 1) dayNumber = 1;

            Expense? expense;

            // 3. 處理 Expense 主表
            if (id.HasValue && id.Value > 0)
            {
                // 編輯模式
                expense = await _context.Expenses
                    .Include(e => e.ExpensePayers)
                    .Include(e => e.ExpenseParticipants)
                    .FirstOrDefaultAsync(e => e.ExpenseId == id.Value); // 注意：您的主鍵是 ExpenseId

                if (expense == null) return Json(new { success = false, message = "找無此支出" });

                // 刪除舊紀錄 (重鋪)
                _context.ExpensePayers.RemoveRange(expense.ExpensePayers);
                _context.ExpenseParticipants.RemoveRange(expense.ExpenseParticipants);
            }
            else
            {
                // 新增模式
                expense = new Expense();
                expense.TripId = tripId;
                _context.Expenses.Add(expense);
            }

            // 更新欄位
            expense.Title = title;
            expense.Amount = amount;
            expense.Day = dayNumber;
            expense.CategoryId = categoryId;

            await _context.SaveChangesAsync(); // 先存檔取得 ID

            // 4. 處理付款人 (Payers)
            var payersDict = JsonSerializer.Deserialize<Dictionary<string, decimal>>(payersJson);
            if (payersDict != null)
            {
                foreach (var kvp in payersDict)
                {
                    if (kvp.Value > 0 && int.TryParse(kvp.Key, out int memberId))
                    {
                        _context.ExpensePayers.Add(new ExpensePayer
                        {
                            ExpenseId = expense.ExpenseId, // 使用 ExpenseId
                            MemberId = memberId,           // [修正] 模型裡叫 MemberId
                            Amount = kvp.Value
                        });
                    }
                }
            }

            // 5. 處理分攤人 (Participants)
            var partsDict = JsonSerializer.Deserialize<Dictionary<string, decimal>>(partsJson);
            if (partsDict != null)
            {
                foreach (var kvp in partsDict)
                {
                    if (kvp.Value > 0 && int.TryParse(kvp.Key, out int memberId))
                    {
                        _context.ExpenseParticipants.Add(new ExpenseParticipant
                        {
                            ExpenseId = expense.ExpenseId, // 使用 ExpenseId
                            TripId = tripId,               // [修正] 必須補上 TripId
                            UserId = memberId,             // [修正] 模型裡這欄位叫 UserId (對應 TripMember ID)
                            ShareAmount = kvp.Value        // [修正] 模型裡叫 ShareAmount，不是 Amount
                                                           // 注意：您的模型中沒有 HasPaid 欄位，所以我移除了
                        });
                    }
                }
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return Json(new { success = false, message = "存檔失敗：" + ex.Message });
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