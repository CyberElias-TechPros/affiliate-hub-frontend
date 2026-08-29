import * as React from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, Building2, Shield, Moon, Bell, HelpCircle, 
  LogOut, ChevronRight, MessageCircle, FileText, ExternalLink 
} from "lucide-react";
import { MenuItem } from "@/components/ui/MenuItem";
import { Switch } from "@/components/ui/switch";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = React.useState(true);

  const darkMode = theme === "dark";

  const handleLogout = () => {
    logout();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Profile Header */}
      <div className="px-4 pt-6 pb-8 gradient-hero">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xl font-bold shadow-glow">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-display text-foreground">{user?.name || "Affiliate"}</h1>
            <p className="text-muted-foreground">{user?.email || ""}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                Pro Affiliate
              </span>
            </div>
          </div>
          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Account Section */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">Account</h2>
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <MenuItem
            icon={<User className="h-5 w-5" />}
            title="Personal Information"
            subtitle="Name, email, phone"
            onClick={() => {}}
          />
          <MenuItem
            icon={<Building2 className="h-5 w-5" />}
            title="Bank Details"
            subtitle="Manage payout accounts"
            onClick={() => {}}
          />
          <MenuItem
            icon={<Shield className="h-5 w-5" />}
            title="Security"
            subtitle="Password, 2FA"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Preferences Section */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">Preferences</h2>
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <MenuItem
            icon={<Moon className="h-5 w-5" />}
            title="Dark Mode"
            showArrow={false}
            rightElement={
              <Switch checked={darkMode} onCheckedChange={toggleTheme} />
            }
          />
          <MenuItem
            icon={<Bell className="h-5 w-5" />}
            title="Notifications"
            showArrow={false}
            rightElement={
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            }
          />
        </div>
      </div>

      {/* Support Section */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2 px-1">Support</h2>
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <MenuItem
            icon={<HelpCircle className="h-5 w-5" />}
            title="Help & FAQ"
            onClick={() => navigate("/help")}
          />
          <MenuItem
            icon={<MessageCircle className="h-5 w-5" />}
            title="Chat with Support"
            subtitle="via WhatsApp"
            onClick={() => window.open("https://wa.me/2348012345678", "_blank")}
          />
          <MenuItem
            icon={<FileText className="h-5 w-5" />}
            title="Terms & Privacy"
            rightElement={<ExternalLink className="h-4 w-4 text-muted-foreground" />}
            showArrow={false}
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 py-4">
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <MenuItem
            icon={<LogOut className="h-5 w-5" />}
            title="Log Out"
            destructive
            showArrow={false}
            onClick={handleLogout}
          />
        </div>
      </div>

      {/* Version */}
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">Affiliate Hub v1.0.0</p>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
