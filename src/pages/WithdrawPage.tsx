import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Wallet, DollarSign, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/ui/CustomInput";
import { toast } from "sonner";

const withdrawMethods = [
  { id: "bank", label: "Bank Transfer", icon: Building2, fee: "Free", time: "1-2 hours" },
  { id: "usdt", label: "USDT (TRC20)", icon: DollarSign, fee: "1%", time: "Instant" },
  { id: "paypal", label: "PayPal", icon: Wallet, fee: "2%", time: "Instant" },
];

const WithdrawPage = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState("bank");
  const [step, setStep] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);

  const availableBalance = 472500;
  const amountNum = parseFloat(amount.replace(/,/g, "")) || 0;
  const isValidAmount = amountNum >= 5000 && amountNum <= availableBalance;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    if (value) {
      setAmount(parseInt(value).toLocaleString());
    } else {
      setAmount("");
    }
  };

  const handleWithdraw = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsLoading(false);
    toast.success("Withdrawal request submitted!");
    navigate("/wallet");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold font-display">Withdraw Funds</h1>
        </div>
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  s <= step ? "gradient-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="p-4">
        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold font-display text-foreground mb-2">
                Enter amount
              </h2>
              <p className="text-muted-foreground">
                Available: <span className="text-foreground font-medium">₦{availableBalance.toLocaleString()}</span>
              </p>
            </div>

            <div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">₦</span>
                <input
                  type="text"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className="w-full h-16 pl-12 pr-4 text-3xl font-bold text-foreground bg-card border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              {amount && !isValidAmount && (
                <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {amountNum < 5000 ? "Minimum withdrawal is ₦5,000" : "Insufficient balance"}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {[10000, 50000, 100000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toLocaleString())}
                  className="flex-1 py-2 rounded-lg bg-muted text-muted-foreground font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  ₦{(preset / 1000)}K
                </button>
              ))}
              <button
                onClick={() => setAmount(availableBalance.toLocaleString())}
                className="flex-1 py-2 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
              >
                Max
              </button>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!isValidAmount}
              className="w-full h-14 gradient-primary text-primary-foreground font-semibold rounded-xl shadow-glow disabled:opacity-50"
            >
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold font-display text-foreground mb-2">
                Select method
              </h2>
              <p className="text-muted-foreground">
                Choose how you want to receive your funds
              </p>
            </div>

            <div className="space-y-3">
              {withdrawMethods.map((m) => {
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isSelected ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      <m.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">{m.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {m.fee} • {m.time}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              onClick={() => setStep(3)}
              className="w-full h-14 gradient-primary text-primary-foreground font-semibold rounded-xl shadow-glow"
            >
              Continue
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold font-display text-foreground mb-2">
                Confirm withdrawal
              </h2>
              <p className="text-muted-foreground">
                Review the details and confirm
              </p>
            </div>

            <div className="bg-card rounded-xl p-4 shadow-card space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-foreground text-lg">₦{amount}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium text-foreground">
                  {withdrawMethods.find((m) => m.id === method)?.label}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-medium text-success">Free</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">You'll receive</span>
                <span className="font-bold text-primary text-xl">₦{amount}</span>
              </div>
            </div>

            {method === "bank" && (
              <div className="space-y-4">
                <CustomInput label="Account Number" placeholder="Enter account number" />
                <CustomInput label="Bank Name" placeholder="Select your bank" />
              </div>
            )}

            <Button
              onClick={handleWithdraw}
              disabled={isLoading}
              className="w-full h-14 gradient-primary text-primary-foreground font-semibold rounded-xl shadow-glow"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                "Confirm Withdrawal"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawPage;
