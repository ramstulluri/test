// "SeleniumExtensions.cs" Copyright (c) Rama.T of [Complica Technologies]. All Rights Reserved.
// Please refer to license file for full terms and conditions of usage.

using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;
using System;
using System.Collections.ObjectModel;

namespace AutomationPro.Core.Browser
{
    public static class SeleniumExtensions
    {
        public static void Exit(this IWebDriver driver)
        {
            driver.Close();
            driver.Quit();
            driver.Dispose();
        }

        public static void TypeAndEnter(this IWebElement webElement, string data)
        {
            webElement.SendKeys(data);
            webElement.SendKeys(Keys.Enter);
        }

        public static int TimeOut => 5;

        public static IWebElement GetParent(this IWebElement element)
        {
            return element.FindElement(By.XPath(".."));
        }

        public static WebDriverWait Wait(this IWebDriver driver)
        {
            return new WebDriverWait(driver, TimeSpan.FromSeconds(TimeOut));
        }

        public static WebDriverWait Wait(this IWebDriver driver, int wait)
        {
            return new WebDriverWait(driver, TimeSpan.FromSeconds(wait));
        }

        public static WaitAnd<TResult> For<TResult>(this WebDriverWait driverWait, Func<IWebDriver, TResult> condition)
        {
            return new WaitAnd<TResult>(driverWait.Until(condition));
        }

        public static IWebElement WaitFor(this IWebDriver driver, By condition)
        {
            return driver.Wait(TimeOut).Until(ExpectedConditions.ElementExists(condition));
        }

        public static IWebElement WaitFor(this IWebDriver driver, By condition, int wait)
        {
            return driver.Wait(wait).Until(ExpectedConditions.ElementExists(condition));
        }

        public static IWebElement WebElementOrDefault(this IWebElement parent, By by)
        {
            try
            {
                var element = parent.FindElement(by);
                return element;
            }
            catch (NoSuchElementException)
            {
                return null;
            }
        }

        public static IWebElement WebElementOrDefault(this IWebElement parent, By by, WebDriverWait wait)
        {
            try
            {
                wait.Until(ExpectedConditions.VisibilityOfAllElementsLocatedBy(by));
                var element = parent.FindElement(by);
                return element;
            }
            catch (Exception ex)
            {
                if (ex is WebDriverTimeoutException || ex is NoSuchElementException)
                    return null;
            }
            return null;
        }

        public static ReadOnlyCollection<IWebElement> WebElementsOrDefault(this IWebElement parent, By by)
        {
            try
            {
                var element = parent.FindElements(by);
                return element;
            }
            catch (NoSuchElementException)
            {
                return null;
            }
        }

        public static bool IsDate(this IWebElement element)
        {
            DateTime result;
            return DateTime.TryParse(element.Text, out result);
        }

        public static string SvgDataText(this IWebElement element)
        {
            return element.GetAttribute("data-text");
        }
        public static string GetText(this IWebElement element)
        {
            return element.GetAttribute("textContent");
        }
        public static string ToNtlmAuthenticationUrl(this string url, string userName, string password)
        {
            var ntlmUrl = "";
            if (url.StartsWith("http://"))
            {
                ntlmUrl = url.Replace("http://", $"http://{userName}:{password}@");
            }
            else if (url.StartsWith("https://"))
            {
                ntlmUrl = url.Replace("https://", $"https://{userName}:{password}@");
            }
            return ntlmUrl;
        }
    }

    public class WaitAnd<TResult>
    {
        private readonly TResult _result;

        public WaitAnd(TResult result)
        {
            _result = result;
        }

        public WaitUse<TResult> And()
        {
            return new WaitUse<TResult>(_result);
        }
    }

    public class WaitUse<TResult>
    {
        private readonly TResult _result;

        public WaitUse(TResult result)
        {
            _result = result;
        }

        public TResult Use()
        {
            return _result;
        }
    }
}

