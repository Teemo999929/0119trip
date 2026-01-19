using System;
using System.Collections.Generic;

namespace _0119trip.Models;

public partial class AspNetRoleClaim
{
    public int Id { get; set; }

    public int RoleId { get; set; }

    public string? ClaimType { get; set; }

    public string? ClaimValue { get; set; }

    public virtual AspNetRole Role { get; set; } = null!;
}
